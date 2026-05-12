// export MSW handlers for testing — v0alpha1 handlers are the default exports for now (matches the
// default state of the `alerting.notificationsAPIV1Beta1` feature toggle). v1beta1 handlers are
// re-exported under namespaced names so tests covering the toggle ON path can target them.
export * from './grafana/api/notifications/v0alpha1/mocks/handlers';

export {
  createReceiverHandler as createReceiverHandlerV1Beta1,
  deletecollectionReceiverHandler as deletecollectionReceiverHandlerV1Beta1,
  deleteReceiverHandler as deleteReceiverHandlerV1Beta1,
  getReceiverHandler as getReceiverHandlerV1Beta1,
  listReceiverHandler as listReceiverHandlerV1Beta1,
  listRoutingTreeHandler as listRoutingTreeHandlerV1Beta1,
  replaceReceiverHandler as replaceReceiverHandlerV1Beta1,
  updateReceiverHandler as updateReceiverHandlerV1Beta1,
} from './grafana/api/notifications/v1beta1/mocks/handlers';

// export mocks and factories — v0alpha1 factories are exported by default; v1beta1 factories are
// available under namespaced names.
export * from './grafana/api/notifications/v0alpha1/mocks/fakes/common';
export * from './grafana/api/notifications/v0alpha1/mocks/fakes/Receivers';
export * from './grafana/api/notifications/v0alpha1/mocks/fakes/Routes';

export {
  ContactPointFactory as ContactPointFactoryV1Beta1,
  ContactPointMetadataAnnotationsFactory as ContactPointMetadataAnnotationsFactoryV1Beta1,
  ContactPointSpecFactory as ContactPointSpecFactoryV1Beta1,
  EmailIntegrationFactory as EmailIntegrationFactoryV1Beta1,
  GenericIntegrationFactory as GenericIntegrationFactoryV1Beta1,
  ListReceiverApiResponseFactory as ListReceiverApiResponseFactoryV1Beta1,
  SlackIntegrationFactory as SlackIntegrationFactoryV1Beta1,
} from './grafana/api/notifications/v1beta1/mocks/fakes/Receivers';
export {
  LabelMatcherFactory as LabelMatcherFactoryV1Beta1,
  ListRoutingTreeApiResponseFactory as ListRoutingTreeApiResponseFactoryV1Beta1,
  RouteFactory as RouteFactoryV1Beta1,
  RoutingTreeFactory as RoutingTreeFactoryV1Beta1,
} from './grafana/api/notifications/v1beta1/mocks/fakes/Routes';

// scenarios
export * from './grafana/contactPoints/components/ContactPointSelector/ContactPointSelector.scenario';
export * from './grafana/notificationPolicies/components/RoutingTreeSelector/RoutingTreeSelector.scenario';
