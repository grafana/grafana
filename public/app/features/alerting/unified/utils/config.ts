import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';

import { isValidPrometheusDuration, safeParsePrometheusDuration } from './time';

export function getAllDataSources(): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
  return Object.values(config.datasources);
}

export function checkEvaluationIntervalGlobalLimit(alertGroupEvaluateEvery?: string) {
  // config.unifiedAlerting.minInterval should be Prometheus-compatible duration
  // However, Go's gtime library has issues with parsing y,w,d
  if (!isValidPrometheusDuration(config.unifiedAlerting.minInterval)) {
    return { globalLimit: 0, exceedsLimit: false };
  }

  const evaluateEveryGlobalLimitMs = safeParsePrometheusDuration(config.unifiedAlerting.minInterval);

  if (!alertGroupEvaluateEvery || !isValidPrometheusDuration(alertGroupEvaluateEvery)) {
    return { globalLimit: evaluateEveryGlobalLimitMs, exceedsLimit: false };
  }

  const evaluateEveryMs = safeParsePrometheusDuration(alertGroupEvaluateEvery);

  const exceedsLimit = evaluateEveryGlobalLimitMs > evaluateEveryMs && evaluateEveryMs > 0;

  return { globalLimit: evaluateEveryGlobalLimitMs, exceedsLimit };
}
