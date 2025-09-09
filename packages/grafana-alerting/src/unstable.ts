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
  findMatchingRoutes,
  getInheritedProperties,
  computeInheritedTree,
} from './grafana/notificationPolicies/utils';
export { USER_DEFINED_TREE_NAME } from './grafana/notificationPolicies/consts';
export * from './grafana/notificationPolicies/types';

// Rules
export { StateText } from './grafana/rules/components/state/StateText';
export { StateDot } from './grafana/rules/components/state/StateDot';
export { StateIcon } from './grafana/rules/components/state/StateIcon';

// Matchers
export { type LabelMatcher, type Label } from './grafana/matchers/types';
export { matchLabelsSet, matchLabels, isLabelMatch, type LabelMatchDetails } from './grafana/matchers/utils';

// Low-level API hooks
export { alertingAPI } from './grafana/api/v0alpha1/api.gen';
