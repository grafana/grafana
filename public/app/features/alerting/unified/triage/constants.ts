import { config } from '@grafana/runtime';

export const VARIABLES = {
  groupBy: 'groupBy',
  filters: 'filters',
};

/**
 * URL parameter names for Scene variables.
 * These are the keys used in the URL for syncing Scene state.
 */
export const URL_PARAMS = {
  filters: 'var-filters',
  groupBy: 'var-groupBy',
  timeFrom: 'from',
  timeTo: 'to',
} as const;

/**
 * All URL parameters that define the triage page state for saved searches.
 * Used to serialize/deserialize saved search state.
 */
export const TRIAGE_STATE_URL_PARAMS = [
  URL_PARAMS.filters,
  URL_PARAMS.groupBy,
  URL_PARAMS.timeFrom,
  URL_PARAMS.timeTo,
] as const;

export const DATASOURCE_UID = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
export const METRIC_NAME = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';

export const SERVICE_FILTER_LABEL_KEYS = ['service', 'service_name'] as const;
export const CLUSTER_FILTER_LABEL_KEYS = ['cluster', 'cluster_name'] as const;
export const NAMESPACE_FILTER_LABEL_KEYS = ['namespace', 'exported_namespace', 'namespace_extracted'] as const;
export const SEVERITY_FILTER_LABEL_KEYS = [
  'severity',
  'priority',
  'level',
  'loglevel',
  'logLevel',
  'lvl',
  'detected_level',
] as const;

export const COMBINED_FILTER_LABEL_KEYS = {
  service: SERVICE_FILTER_LABEL_KEYS,
  cluster: CLUSTER_FILTER_LABEL_KEYS,
  namespace: NAMESPACE_FILTER_LABEL_KEYS,
  severity: SEVERITY_FILTER_LABEL_KEYS,
} as const;

/**
 * Internal/structural labels to exclude from frequency counting.
 *
 * Prometheus internal:
 *   __name__, alertname, alertstate
 *
 * Grafana structural (rule identity / routing):
 *   grafana_alertstate, grafana_folder, grafana_rule_uid
 *
 * Grafana instance metadata (org/folder context, state-history origin):
 *   orgID, folderUID, from
 */
export const INTERNAL_LABELS = new Set([
  '__name__',
  'alertname',
  'alertstate',
  'folderUID',
  'from',
  'grafana_alertstate',
  'grafana_folder',
  'grafana_rule_uid',
  'orgID',
]);

/**
 * DataFrame field names returned by the alert history metric queries.
 */
export const FIELD_NAMES = {
  alertstate: 'alertstate',
  alertname: 'alertname',
  grafanaFolder: 'grafana_folder',
  grafanaRuleUID: 'grafana_rule_uid',
  value: 'Value',
  valuePrefix: 'Value #',
} as const;

export const DEFAULT_FIELDS = [
  FIELD_NAMES.alertname,
  FIELD_NAMES.grafanaFolder,
  FIELD_NAMES.grafanaRuleUID,
  FIELD_NAMES.alertstate,
] as const;
