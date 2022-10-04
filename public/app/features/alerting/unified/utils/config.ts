import { DataSourceInstanceSettings, DataSourceJsonData, rangeUtil, isValidGoDuration } from '@grafana/data';
import { config } from '@grafana/runtime';

import { isValidPrometheusDuration, parsePrometheusDuration } from './time';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}

export function checkEvaluationIntervalGlobalLimit(alertGroupEvaluateEvery?: string) {
  // There is a discrepancy between the duration format for evaluateEvery and unifiedAlerting.minInterval
  // "evaluateEvery" is a Prometheus duration and supports d, w, y – "minInterval" is
  // a strict golang time.ParseDuration compatible format
  if (!alertGroupEvaluateEvery || !isValidPrometheusDuration(alertGroupEvaluateEvery)) {
    return { globalLimit: 0, exceedsLimit: false };
  }

  if (!isValidGoDuration(config.unifiedAlerting.minInterval)) {
    return { globalLimit: 0, exceedsLimit: false };
  }

  const evaluateEveryMs = parsePrometheusDuration(alertGroupEvaluateEvery);
  const evaluateEveryGlobalLimitMs = rangeUtil.intervalToMs(config.unifiedAlerting.minInterval);

  const exceedsLimit = evaluateEveryGlobalLimitMs > evaluateEveryMs && evaluateEveryMs > 0;

  return { globalLimit: evaluateEveryGlobalLimitMs, exceedsLimit };
}
