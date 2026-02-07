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
export const DEFAULT_FIELDS = ['alertname', 'grafana_folder', 'grafana_rule_uid', 'alertstate'] as const;
