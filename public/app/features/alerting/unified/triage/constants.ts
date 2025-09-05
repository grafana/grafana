import { config } from '@grafana/runtime';

export const VARIABLES = {
  groupBy: 'groupBy',
  filters: 'filters',
};

export const DATASOURCE_UID = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
export const METRIC_NAME = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
export const DEFAULT_FIELDS = ['alertname', 'grafana_folder', 'grafana_rule_uid', 'alertstate'];
