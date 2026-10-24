/**
 * Export things here that you want to be available under @grafana/alerting/unstable
 */

// Contact Points
export { type ContactPoint, type Integration } from './grafana/api/notifications/v1beta1/types';
export { useListContactPoints } from './grafana/contactPoints/hooks/v1beta1/useContactPoints';
export { ContactPointSelector } from './grafana/contactPoints/components/ContactPointSelector/ContactPointSelector';
export {
  getContactPointDescription,
  getContactPointInUse,
  getContactPointInUseRoutes,
  getContactPointInUseRules,
} from './grafana/contactPoints/utils';

// Notification Policies / Routing Trees
export { useRoutingTrees } from './grafana/notificationPolicies/hooks/useRoutingTrees';
export { useMatchInstancesToSpecificRouteTree } from './grafana/notificationPolicies/hooks/useMatchPolicies';
export { RoutingTreeSelector } from './grafana/notificationPolicies/components/RoutingTreeSelector/RoutingTreeSelector';
export {
  buildRoutingTreeOptions,
  findRoutingTreeByName,
  getRoutingTreeDisplayName,
  isDefaultRoutingTreeName,
  isDefaultRoutingTree,
} from './grafana/notificationPolicies/routingTree.utils';

// Rules
export { StateText } from './grafana/rules/components/state/StateText';
export { StateIcon } from './grafana/rules/components/state/StateIcon';
export { AlertLabel } from './grafana/rules/components/labels/AlertLabel';
export { AlertLabels } from './grafana/rules/components/labels/AlertLabels';
export {
  ALERTNAME_LABEL,
  GRAFANA_FOLDER_LABEL,
  ALERT_RULE_UID_LABEL,
  ALERT_RULE_NAMESPACE_UID_LABEL,
  getGrafanaRuleInstanceLabels,
} from './grafana/rules/utils/labels';

// Matchers
export { MatcherBadge } from './grafana/matchers/components/MatcherBadge';
export { matchLabelsSet, matchLabels, isLabelMatch, type LabelMatchDetails } from './grafana/matchers/utils';

// Data sources
// These bundle the discovery code, which imports @grafana/runtime/unstable (>=13.2, a declared peer).
export { getDataSourcesWithValidRecordingTarget } from './grafana/dataSources/narrowings';
export { useDataSourcesWithValidRecordingTarget } from './grafana/dataSources/hooks';

// API endpoints
export { generatedAPI as notificationsAPIv1beta1 } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
export { generatedAPI as rulesAPIv0alpha1 } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
export { generatedAPI as historianAPIv0alpha1 } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
export { alertingAPIReducers, alertingAPIMiddleware, createAlertingStore } from './grafana/api/store';
