import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
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

// Which history view to show for a rule. Not the same as the configured backend: some backends
// have no view of their own, and some cannot answer history queries at all.
export enum StateHistoryImplementation {
  Loki = 'loki',
  Annotations = 'annotations',
  Unavailable = 'unavailable',
}

// Works out which backend answers state history reads, then maps it to a view.
// "backend" can be "loki", "annotations", "prometheus", "multiple" or "noop"; when it's
// "multiple", "primary" names the one that answers queries. Secondary backends are written
// to but never read from, so Loki as a secondary cannot serve history.
export function getStateHistoryImplementation(): StateHistoryImplementation {
  const { stateHistory, alertStateHistoryBackend, alertStateHistoryPrimary } = config.unifiedAlerting;

  // Grafana only started sending the nested stateHistory object in 12.4, so read the older flat
  // fields when it is missing. Without this an older Grafana looks the same as history being off.
  const backend = normalizeBackendName(stateHistory?.backend ?? alertStateHistoryBackend);
  const primary = normalizeBackendName(stateHistory?.primary ?? alertStateHistoryPrimary);

  const readBackend = backend === 'multiple' ? primary : backend;

  switch (readBackend) {
    case 'loki':
      return StateHistoryImplementation.Loki;
    case 'annotations':
      return StateHistoryImplementation.Annotations;
    // Anything else has no history view we can show. Grafana sends no state history settings at
    // all when history is turned off, and neither the Prometheus nor the noop backend can answer
    // history queries. A backend name we do not know about lands here too, which happens when
    // Grafana is newer than the frontend and has added a backend since. Showing the annotations
    // view for any of these would render an empty list as though history were working.
    default:
      return StateHistoryImplementation.Unavailable;
  }
}

// Whether history can be shown at all. Use this when a yes or no is all you need, and
// getStateHistoryImplementation when you need to know which view to render.
export function isStateHistoryAvailable(): boolean {
  return getStateHistoryImplementation() !== StateHistoryImplementation.Unavailable;
}

function normalizeBackendName(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized === '' ? undefined : normalized;
}
