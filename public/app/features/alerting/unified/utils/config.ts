import { DataSourceInstanceSettings, DataSourceJsonData, rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';

import { isValidGoDuration, isValidPrometheusDuration } from './time';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}

export function checkEvaluationIntervalGlobalLimit(alertGroupEvaluateEvery?: string) {
  // There is a discrepancy between the duration format for evaluateEvery and unifiedAlerting.minInterval

  if (!alertGroupEvaluateEvery || !isValidPrometheusDuration(alertGroupEvaluateEvery)) {
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
