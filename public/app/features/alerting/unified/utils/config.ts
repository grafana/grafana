import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';

import { parseDurationToMilliseconds } from './time';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}

export function checkEvaluationIntervalGlobalLimit(alertGroupEvaluateEvery: string) {
  const evaluateEveryMillis = parseDurationToMilliseconds(alertGroupEvaluateEvery);
  const evaluateEveryGlobalLimitMillis = parseDurationToMilliseconds(config.unifiedAlerting.minInterval);

  const exceedsLimit = evaluateEveryGlobalLimitMillis > evaluateEveryMillis && evaluateEveryMillis > 0;

  return { globalLimit: evaluateEveryGlobalLimitMillis, exceedsLimit };
}
