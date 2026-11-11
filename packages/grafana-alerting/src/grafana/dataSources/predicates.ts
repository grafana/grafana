import { type DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';

import { type AlertManagerDataSourceJsonData, AlertManagerImplementation } from './types';

export const SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES = [
  'prometheus',
  'grafana-amazonprometheus-datasource',
  'grafana-azureprometheus-datasource',
] as const;

export type SupportedExternalPrometheusFlavoredRulesSourceType =
  (typeof SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)[number];

/**
 * Check if the given type is a supported external Prometheus flavored rules source type.
 */
export function isSupportedExternalPrometheusFlavoredRulesSourceType(
  type: string
): type is SupportedExternalPrometheusFlavoredRulesSourceType {
  return SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES.find((t) => t === type) !== undefined;
}

export function isDataSourceManagingAlerts(ds: Pick<DataSourceInstanceSettings, 'jsonData'>): boolean {
  return ds.jsonData.manageAlerts ?? config.defaultDatasourceManageAlertsUiToggle;
}

export function isDataSourceAllowedAsRecordingRulesTarget(ds: DataSourceInstanceSettings): boolean {
  return ds.jsonData.allowAsRecordingRulesTarget !== false; // if this prop is undefined it defaults to true
}

export function isValidRecordingRulesTarget(ds: DataSourceInstanceSettings): boolean {
  return isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type) && isDataSourceAllowedAsRecordingRulesTarget(ds);
}

export type SupportedExternalRulesSourceType = 'loki' | SupportedExternalPrometheusFlavoredRulesSourceType;
export const SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES = [
  'loki',
  ...SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
] as const;

/**
 * Check if the given type is a supported external rules source type. Includes Loki and Prometheus flavored types.
 */
export function isSupportedExternalRulesSourceType(type: string): type is SupportedExternalRulesSourceType {
  return SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES.find((t) => t === type) !== undefined;
}

// when the `implementation` is set to `undefined` we assume we're dealing with an AlertManager with config API. The reason for this is because
// our Hosted Grafana stacks provision Alertmanager data sources without `jsonData: { implementation: "mimir" }`.
const CONFIG_API_ENABLED_ALERTMANAGER_FLAVORS = [
  AlertManagerImplementation.mimir,
  AlertManagerImplementation.cortex,
  undefined,
];

export function isAlertManagerWithConfigAPI(
  dataSourceConfig: Pick<AlertManagerDataSourceJsonData, 'implementation'>
): boolean {
  return CONFIG_API_ENABLED_ALERTMANAGER_FLAVORS.includes(dataSourceConfig.implementation);
}
