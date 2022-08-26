import { DataSourceInstanceSettings, DataSourceJsonData, isValidGoDuration, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}

export function checkEvaluationIntervalGlobalLimit(alertGroupEvaluateEvery?: string) {
  if (!alertGroupEvaluateEvery || !isValidGoDuration(alertGroupEvaluateEvery)) {
    return { globalLimit: 0, exceedsLimit: false };
  }

  if (!isValidGoDuration(config.unifiedAlerting.minInterval)) {
    return { globalLimit: 0, exceedsLimit: false };
  }

  const evaluateEveryMs = rangeUtil.intervalToMs(alertGroupEvaluateEvery);
  const evaluateEveryGlobalLimitMs = rangeUtil.intervalToMs(config.unifiedAlerting.minInterval);

  const exceedsLimit = evaluateEveryGlobalLimitMs > evaluateEveryMs && evaluateEveryMs > 0;

  return { globalLimit: evaluateEveryGlobalLimitMs, exceedsLimit };
}
