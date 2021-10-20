import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  FieldCache,
  FieldType,
  getLogLevelFromKey,
  Labels,
  LoadingState,
  LogLevel,
  toDataFrame,
} from '@grafana/data';
import { LokiQuery } from '../types';
import { Observable, throwError, timeout } from 'rxjs';
import { cloneDeep } from 'lodash';
import LokiDatasource, { isMetricsQuery } from '../datasource';
import { aggregateRawLogsVolume } from '../../../../core/logs_model';

/**
 * Logs volume query may be expensive as it requires counting all logs in the selected range. If such query
 * takes too much time it may need be made more specific to limit number of logs processed under the hood.
 */
const TIMEOUT = 10000;

export function createLokiLogsVolumeProvider(
  datasource: LokiDatasource,
  dataQueryRequest: DataQueryRequest<LokiQuery>
): Observable<DataQueryResponse> {
  const logsVolumeRequest = cloneDeep(dataQueryRequest);
  logsVolumeRequest.targets = logsVolumeRequest.targets
    .filter((target) => target.expr && !isMetricsQuery(target.expr))
    .map((target) => {
      return {
        ...target,
        instant: false,
        expr: `sum by (level) (count_over_time(${target.expr}[$__interval]))`,
      };
    });

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
          with: () => throwError(new Error('Request timed-out. Please make your query more specific and try again.')),
        })
      )
      .subscribe({
        complete: () => {
          const aggregatedLogsVolume = aggregateRawLogsVolume(rawLogsVolume, extractLevel);
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

function extractLevel(dataFrame: DataFrame): LogLevel {
  let valueField;
  try {
    valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number);
  } catch {}
  return valueField?.labels ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
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
