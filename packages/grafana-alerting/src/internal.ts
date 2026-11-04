/**
 * Export things here that you want to be available under @grafana/alerting/internal
 */

export { INHERITABLE_KEYS, type InheritableProperties } from './grafana/notificationPolicies/route.utils';

export {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  type SupportedExternalPrometheusFlavoredRulesSourceType,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isDataSourceAllowedAsRecordingRulesTarget,
  isDataSourceManagingAlerts,
  isValidRecordingRulesTarget,
} from './grafana/dataSources/predicates';

export { getDataSourcesManagingAlerts, getDataSourcesWithValidRecordingTarget } from './grafana/dataSources/narrowings';
export {
  type DataSourcesManagingAlertsByUidResult,
  type DataSourcesWithValidRecordingTargetByUidResult,
  useDataSourcesManagingAlertsByUid,
  useDataSourcesWithValidRecordingTarget,
  useDataSourcesWithValidRecordingTargetByUid,
} from './grafana/dataSources/hooks';

export default {};
