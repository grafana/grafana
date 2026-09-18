import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';

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

export function isDataSourceAllowedAsRecordingRulesTarget(ds: DataSourceInstanceSettings<DataSourceJsonData>) {
  return ds.jsonData.allowAsRecordingRulesTarget !== false; // if this prop is undefined it defaults to true
}

export function isValidRecordingRulesTarget(ds: DataSourceInstanceSettings<DataSourceJsonData>): boolean {
  return isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type) && isDataSourceAllowedAsRecordingRulesTarget(ds);
}
