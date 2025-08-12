/**
 * Export things here that you want to be available under @grafana/alerting/unstable
 */

// Contact Points
export * from './grafana/api/v0alpha1/types';
export { useListContactPoints } from './grafana/contactPoints/hooks/v0alpha1/useContactPoints';
export { ContactPointSelector } from './grafana/contactPoints/components/ContactPointSelector/ContactPointSelector';
export { getContactPointDescription } from './grafana/contactPoints/utils';

// Notification Policies
export {
  useMatchAlertInstancesToNotificationPolicies,
  type RouteMatch,
  type InstanceMatchResult,
} from './grafana/notificationPolicies/hooks/useMatchPolicies';
export {
  type TreeMatch,
  type RouteMatchResult,
  matchAlertInstancesToPolicyTree,
} from './grafana/notificationPolicies/utils';
export { USER_DEFINED_TREE_NAME } from './grafana/notificationPolicies/consts';
export * from './grafana/notificationPolicies/types';

// Matchers
export { type LabelMatcher } from './grafana/matchers/types';

// Low-level API hooks
export { alertingAPI } from './grafana/api/v0alpha1/api.gen';
