import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  FieldCache,
  FieldType,
  getLogLevelFromKey,
  Labels,
  LogLevel,
} from '@grafana/data';
import { LokiQuery } from '../types';
import { Observable } from 'rxjs';
import { cloneDeep } from 'lodash';
import LokiDatasource, { isMetricsQuery } from '../datasource';
import { queryLogsVolume } from '../../../../core/logs_model';

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
  return queryLogsVolume(datasource, logsVolumeRequest, {
    timeout: TIMEOUT,
    extractLevel,
    range: dataQueryRequest.range,
    targets: dataQueryRequest.targets,
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
