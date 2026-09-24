/**
 * Export things here that you want to be available under @grafana/alerting/internal
 */

export { INHERITABLE_KEYS, type InheritableProperties } from './grafana/notificationPolicies/utils';

export {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  type SupportedExternalPrometheusFlavoredRulesSourceType,
  isSupportedExternalPrometheusFlavoredRulesSourceType,
  isDataSourceAllowedAsRecordingRulesTarget,
  isValidRecordingRulesTarget,
} from './grafana/dataSources/predicates';

export {
  getDataSourcesWithValidRecordingTarget,
  useDataSourcesWithValidRecordingTarget,
} from './grafana/dataSources/narrowings';

export default {};
