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
