/**
 * Export things here that you want to be available under @grafana/alerting/unstable
 */

// Contact Points
// Types are sourced from v1beta1 (structurally identical to v0alpha1); see notifications/index.ts for the rationale.
export * from './grafana/api/notifications/v1beta1/types';
export { useListContactPoints } from './grafana/contactPoints/hooks/useContactPoints';
export { ContactPointSelector } from './grafana/contactPoints/components/ContactPointSelector/ContactPointSelector';
export { getContactPointDescription } from './grafana/contactPoints/utils';

// Notification Policies / Routing Trees
export { useListRoutingTrees } from './grafana/notificationPolicies/hooks/useRoutingTrees';
export { useMatchInstancesToSpecificRouteTree } from './grafana/notificationPolicies/hooks/useMatchPolicies';
export { RoutingTreeSelector } from './grafana/notificationPolicies/components/RoutingTreeSelector/RoutingTreeSelector';
export { isDefaultRoutingTree } from './grafana/notificationPolicies/consts';

// Rules
export { StateText } from './grafana/rules/components/state/StateText';
export { StateIcon } from './grafana/rules/components/state/StateIcon';
export { AlertLabel, type AlertLabelProps } from './grafana/rules/components/labels/AlertLabel';
export { AlertLabels, type AlertLabelsProps } from './grafana/rules/components/labels/AlertLabels';

// Matchers
export { type LabelMatcher, type Label } from './grafana/matchers/types';
export { matchLabelsSet, matchLabels, isLabelMatch, type LabelMatchDetails } from './grafana/matchers/utils';

// Notifications API — toggle-aware re-export. Use this in new code; the version-specific exports below are kept
// for the duration of the v0alpha1 → v1beta1 migration and will be removed in the cleanup PR.
export { notificationsAPI, API_GROUP, API_VERSION, BASE_URL } from './grafana/api/notifications';
// Types from the generated client (Receiver, RoutingTree, TimeInterval, etc.). Sourced from v1beta1;
// structurally identical to v0alpha1.
export type * from './grafana/api/notifications';
export { generatedAPI as notificationsAPIv0alpha1 } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
export { generatedAPI as notificationsAPIv1beta1 } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

// Other alerting API endpoints
export { generatedAPI as rulesAPIv0alpha1 } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
export { generatedAPI as historianAPIv0alpha1 } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
