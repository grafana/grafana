import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  FieldCache,
  FieldColorModeId,
  FieldConfig,
  FieldType,
  getLogLevelFromKey,
  Labels,
  LoadingState,
  LogLevel,
  MutableDataFrame,
  ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { LokiQuery } from '../types';
import { Observable, throwError, timeout } from 'rxjs';
import { cloneDeep } from 'lodash';
import LokiDatasource, { isMetricsQuery } from '../datasource';
import { LogLevelColor } from '../../../../core/logs_model';
import { BarAlignment, GraphDrawStyle, StackingMode } from '@grafana/schema';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Logs volume query may be expensive as it requires counting all logs in the selected range. If such query
 * takes too much time it may need be made more specific to limit number of logs processed under the hood.
 */
const TIMEOUT = 10 * SECOND;

export function createLokiLogsVolumeProvider(
  datasource: LokiDatasource,
  dataQueryRequest: DataQueryRequest<LokiQuery>
): Observable<DataQueryResponse> {
  const logsVolumeRequest = cloneDeep(dataQueryRequest);
  const intervalInfo = getIntervalInfo(dataQueryRequest.scopedVars);
  logsVolumeRequest.targets = logsVolumeRequest.targets
    .filter((target) => target.expr && !isMetricsQuery(target.expr))
    .map((target) => {
      return {
        ...target,
        instant: false,
        expr: `sum by (level) (count_over_time(${target.expr}[${intervalInfo.interval}]))`,
      };
    });
  logsVolumeRequest.interval = intervalInfo.interval;
  if (intervalInfo.intervalMs !== undefined) {
    logsVolumeRequest.intervalMs = intervalInfo.intervalMs;
  }

  return new Observable((observer) => {
    let rawLogsVolume: DataFrame[] = [];
    observer.next({
      state: LoadingState.Loading,
      error: undefined,
      data: [],
    });

    const subscription = datasource
      .query(logsVolumeRequest)
      .pipe(
        timeout({
          each: TIMEOUT,
          with: () =>
            throwError(
              new Error(
                'Request timed-out. Please try making your query more specific or narrow selected time range and try again.'
              )
            ),
        })
      )
      .subscribe({
        complete: () => {
          const aggregatedLogsVolume = aggregateRawLogsVolume(rawLogsVolume);
          if (aggregatedLogsVolume[0]) {
            aggregatedLogsVolume[0].meta = {
              custom: {
                targets: dataQueryRequest.targets,
                absoluteRange: { from: dataQueryRequest.range.from.valueOf(), to: dataQueryRequest.range.to.valueOf() },
              },
            };
          }
          observer.next({
            state: LoadingState.Done,
            error: undefined,
            data: aggregatedLogsVolume,
          });
          observer.complete();
        },
        next: (dataQueryResponse: DataQueryResponse) => {
          rawLogsVolume = rawLogsVolume.concat(dataQueryResponse.data.map(toDataFrame));
        },
        error: (error) => {
          observer.next({
            state: LoadingState.Error,
            error: error,
            data: [],
          });
          observer.error(error);
        },
      });
    return () => {
      subscription?.unsubscribe();
    };
  });
}

/**
 * Add up values for the same level and create a single data frame for each level
 */
function aggregateRawLogsVolume(rawLogsVolume: DataFrame[]): DataFrame[] {
  const logsVolumeByLevelMap: { [level in LogLevel]?: DataFrame[] } = {};
  let levels = 0;
  rawLogsVolume.forEach((dataFrame) => {
    let valueField;
    try {
      valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number);
    } catch {}
    // If value field doesn't exist skip the frame (it may happen with instant queries)
    if (!valueField) {
      return;
    }
    const level: LogLevel = valueField.labels ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
    if (!logsVolumeByLevelMap[level]) {
      logsVolumeByLevelMap[level] = [];
      levels++;
    }
    logsVolumeByLevelMap[level]!.push(dataFrame);
  });

  return Object.keys(logsVolumeByLevelMap).map((level: string) => {
    return aggregateFields(logsVolumeByLevelMap[level as LogLevel]!, getFieldConfig(level as LogLevel, levels));
  });
}

function getFieldConfig(level: LogLevel, levels: number) {
  const name = levels === 1 && level === LogLevel.unknown ? 'logs' : level;
  const color = LogLevelColor[level];
  return {
    displayNameFromDS: name,
    color: {
      mode: FieldColorModeId.Fixed,
      fixedColor: color,
    },
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      barAlignment: BarAlignment.Center,
      lineColor: color,
      pointColor: color,
      fillColor: color,
      lineWidth: 1,
      fillOpacity: 100,
      stacking: {
        mode: StackingMode.Normal,
        group: 'A',
      },
    },
  };
}

/**
 * Create a new data frame with a single field and values creating by adding field values
 * from all provided data frames
 */
function aggregateFields(dataFrames: DataFrame[], config: FieldConfig): DataFrame {
  const aggregatedDataFrame = new MutableDataFrame();
  if (!dataFrames.length) {
    return aggregatedDataFrame;
  }

  const totalLength = dataFrames[0].length;
  const timeField = new FieldCache(dataFrames[0]).getFirstFieldOfType(FieldType.time);

  if (!timeField) {
    return aggregatedDataFrame;
  }

  aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, totalLength);
  aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config }, totalLength);

  dataFrames.forEach((dataFrame) => {
    dataFrame.fields.forEach((field) => {
      if (field.type === FieldType.number) {
        for (let pointIndex = 0; pointIndex < totalLength; pointIndex++) {
          const currentValue = aggregatedDataFrame.get(pointIndex).Value;
          const valueToAdd = field.values.get(pointIndex);
          const totalValue =
            currentValue === null && valueToAdd === null ? null : (currentValue || 0) + (valueToAdd || 0);
          aggregatedDataFrame.set(pointIndex, { Value: totalValue, Time: timeField.values.get(pointIndex) });
        }
      }
    });
  });

  return aggregatedDataFrame;
}

function getLogLevelFromLabels(labels: Labels): LogLevel {
  const labelNames = ['level', 'lvl', 'loglevel'];
  let levelLabel;
  for (let labelName of labelNames) {
    if (labelName in labels) {
      levelLabel = labelName;
      break;
    }
  }
  return levelLabel ? getLogLevelFromKey(labels[levelLabel]) : LogLevel.unknown;
}

function getIntervalInfo(scopedVars: ScopedVars): { interval: string; intervalMs?: number } {
  if (scopedVars.__interval) {
    let intervalMs: number = scopedVars.__interval_ms.value;
    let interval = '';
    if (intervalMs > HOUR) {
      intervalMs = DAY;
      interval = '1d';
    } else if (intervalMs > MINUTE) {
      intervalMs = HOUR;
      interval = '1h';
    } else if (intervalMs > SECOND) {
      intervalMs = MINUTE;
      interval = '1m';
    } else {
      intervalMs = SECOND;
      interval = '1s';
    }

    return { interval, intervalMs };
  } else {
    return { interval: '$__interval' };
  }
}
