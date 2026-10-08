// Centralizes generated-client imports and version selection. Incompatible API changes still need
// consumer migration.
export {
  API_VERSION,
  generatedAPI as notificationsAPI,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

export type {
  ListReceiverApiArg,
  Receiver,
  RoutingTree,
  RoutingTreeMatcher,
  RoutingTreeRoute,
  TimeInterval,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

export * from './v1beta1/types';
