import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';

import { parseDurationToMilliseconds } from './time';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}

export function checkEvaluationIntervalGlobalLimit(alertGroupEvaluateEvery: string) {
  const evaluateEveryMilis = parseDurationToMilliseconds(alertGroupEvaluateEvery);
  const evaluateEveryGlobalLimitMilis = parseDurationToMilliseconds(config.unifiedAlerting.minInterval);

  const exceedsLimit = evaluateEveryGlobalLimitMilis > evaluateEveryMilis && evaluateEveryMilis > 0;

  return { globalLimit: evaluateEveryGlobalLimitMilis, exceedsLimit };
}
