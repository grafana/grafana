/**
 * Export things here that you want to be available under @grafana/alerting/internal
 */

export { INHERITABLE_KEYS, type InheritableProperties } from './grafana/notificationPolicies/route.utils';

export {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES,
  type SupportedExternalPrometheusFlavoredRulesSourceType,
  type SupportedExternalRulesSourceType,
  VICTORIA_LOGS_RULES_SOURCE_TYPE,
  isAlertManagerWithConfigAPI,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isSupportedExternalRulesSourceType,
  isDataSourceAllowedAsRecordingRulesTarget,
  isDataSourceManagingAlerts,
  isValidRecordingRulesTarget,
} from './grafana/dataSources/predicates';

export { type AlertManagerDataSourceJsonData, AlertManagerImplementation } from './grafana/dataSources/types';

export { getDataSourcesManagingAlerts, getDataSourcesWithValidRecordingTarget } from './grafana/dataSources/narrowings';
export { type RulesSourceDataSource } from './grafana/dataSources/rulesSources';
export {
  type DataSourcesManagingAlertsByUidResult,
  type DataSourcesWithValidRecordingTargetByUidResult,
  type RulesSourceDataSourcesResult,
  useDataSourcesManagingAlertsByUid,
  useDataSourcesWithValidRecordingTarget,
  useDataSourcesWithValidRecordingTargetByUid,
  useRulesSourceDataSources,
} from './grafana/dataSources/hooks';

export default {};
