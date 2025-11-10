/**
 * Export things here that you want to be available under @grafana/alerting
 *
 * ⚠️ This implies everything in here is public API and should be considered stable and treated as such – make sure to
 * think carefully about what you export here and the interfaces / data structures.
 *
 * Breaking changes should be avoided to maintain backwards compatibility for consumers of this package.
 */

export { AlertLabels } from './grafana/rules/components/labels/AlertLabels';
export { AlertLabel } from './grafana/rules/components/labels/AlertLabel';
// keep label utils internal to the app for now

/**
 * Notification policies and label matching
 */
export {
  useMatchInstancesToRouteTrees,
  matchInstancesToRouteTrees,
  type RouteMatch,
  type InstanceMatchResult,
} from './grafana/notificationPolicies/hooks/useMatchPolicies';

export {
  type TreeMatch,
  type RouteMatchResult,
  matchInstancesToRoute,
  findMatchingRoutes,
  getInheritedProperties,
  computeInheritedTree,
} from './grafana/notificationPolicies/utils';

export { USER_DEFINED_TREE_NAME } from './grafana/notificationPolicies/consts';
export * from './grafana/notificationPolicies/types';

/**
 * Labels and matchers
 */
export { type LabelMatcher, type Label } from './grafana/matchers/types';

// Utilities
export { base64UrlEncode } from './grafana/api/util';
