import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  FieldCache,
  FieldColorModeId,
  FieldType,
  LogLevel,
  LogsVolumeProvider,
  toDataFrame,
} from '@grafana/data';
import { LokiQuery } from '../types';
import { Observable } from 'rxjs';
import { cloneDeep } from 'lodash';
import LokiDatasource, { isMetricsQuery } from '../datasource';
import { aggregateFields, getLogLevelFromLabels } from '../../../../features/explore/state/utils';
import { LogLevelColor } from '../../../../core/logs_model';
import { BarAlignment, GraphDrawStyle, StackingMode } from '@grafana/schema';

export class LokiLogsVolumeProvider implements LogsVolumeProvider {
  private readonly datasource: LokiDatasource;
  private dataQueryRequest: DataQueryRequest<LokiQuery>;
  private rawLogsVolume: DataFrame[];

  constructor(datasource: LokiDatasource) {
    this.datasource = datasource;
    this.rawLogsVolume = [];
  }

  setRequest(dataQueryRequest: DataQueryRequest<LokiQuery>): void {
    this.dataQueryRequest = dataQueryRequest;
  }

  getLogsVolume(): Observable<DataFrame[]> {
    const histogramRequest = cloneDeep(this.dataQueryRequest);
    histogramRequest.targets = histogramRequest.targets
      .filter((target) => !isMetricsQuery(target.expr))
      .map((target) => {
        target.expr = `count_over_time(${target.expr}[$__interval])`;
        return target;
      });

    return new Observable((observer) => {
      const subscription = this.datasource.query(histogramRequest).subscribe({
        complete: () => {
          const aggregatedLogsVolume = this.aggregateRawLogsVolume();
          observer.next(aggregatedLogsVolume);
          observer.complete();
        },
        next: (dataQueryResponse: DataQueryResponse) => {
          this.rawLogsVolume = this.rawLogsVolume.concat(dataQueryResponse.data.map(toDataFrame));
        },
      });
      return () => {
        subscription.unsubscribe();
      };
    });
  }

  private aggregateRawLogsVolume(): DataFrame[] {
    // Aggregate data frames by level
    const logsVolumeByLevelMap: Record<string, DataFrame[]> = {};
    this.rawLogsVolume.forEach((dataFrame) => {
      const valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number)!;
      const level: LogLevel = valueField.labels ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
      if (!logsVolumeByLevelMap[level]) {
        logsVolumeByLevelMap[level] = [];
      }
      logsVolumeByLevelMap[level].push(dataFrame);
    });

    // Reduce all data frames to a single data frame containing total value
    return Object.keys(logsVolumeByLevelMap).map((level: LogLevel) => {
      const dataFrames = logsVolumeByLevelMap[level];
      const color = LogLevelColor[level];
      const fieldConfig = {
        displayNameFromDS: level,
        color: {
          mode: FieldColorModeId.Fixed,
          fixedColor: color,
        },
        custom: {
          drawStyle: GraphDrawStyle.Bars,
          barAlignment: BarAlignment.Center,
          barWidthFactor: 0.9,
          barMaxWidth: 5,
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
      return aggregateFields(dataFrames, fieldConfig);
    });
  }
}
