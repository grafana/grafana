// MSW handlers and mock factories are toggle-aware: they import `API_GROUP` / `API_VERSION` from
// the centralized notifications dispatcher, so they automatically register the v0alpha1 or v1beta1
// URLs and `apiVersion` based on the `alerting.notificationsAPIV1Beta1` feature toggle value at
// module-load time. Tests that exercise the toggle ON path must reset module state (see
// `notifications/index.test.ts` for the `jest.resetModules()` pattern).
export * from './grafana/api/notifications/mocks/handlers';
export * from './grafana/api/notifications/mocks/fakes/common';
export * from './grafana/api/notifications/mocks/fakes/Receivers';
export * from './grafana/api/notifications/mocks/fakes/Routes';

// scenarios
export * from './grafana/contactPoints/components/ContactPointSelector/ContactPointSelector.scenario';
export * from './grafana/notificationPolicies/components/RoutingTreeSelector/RoutingTreeSelector.scenario';
