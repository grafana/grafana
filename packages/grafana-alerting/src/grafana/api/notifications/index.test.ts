// The switching module reads the feature toggle at module-load time. To exercise both branches
// without restructuring production code, each test resets the Jest module registry and then
// dynamically imports `@grafana/runtime` and the dispatcher together so they share the same
// `config` instance and the toggle value is observed during module init. Static top-of-file
// imports would lock the dispatcher (and every module that depends on it) to whatever toggle
// value happened to be set when this file first loaded, so `await import(...)` is load-bearing
// here — not a stylistic choice.

describe('notifications switching layer', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  async function loadWithToggle(enabled: boolean) {
    const runtime = await import('@grafana/runtime');
    runtime.config.featureToggles['alerting.notificationsAPIV1Beta1'] = enabled;
    return import('./index');
  }

  it('resolves to v0alpha1 by default (toggle off)', async () => {
    const { notificationsAPI, API_VERSION } = await loadWithToggle(false);
    expect(API_VERSION).toBe('v0alpha1');
    expect(notificationsAPI.reducerPath).toBe('notificationsAlertingAPIv0alpha1');
  });

  it('resolves to v1beta1 when toggle is enabled', async () => {
    const { notificationsAPI, API_VERSION } = await loadWithToggle(true);
    expect(API_VERSION).toBe('v1beta1');
    expect(notificationsAPI.reducerPath).toBe('notificationsAlertingAPIv1beta1');
  });

  it('exposes the same API_GROUP regardless of toggle', async () => {
    const v0 = await loadWithToggle(false);
    jest.resetModules();
    const v1 = await loadWithToggle(true);
    expect(v0.API_GROUP).toBe('notifications.alerting.grafana.app');
    expect(v1.API_GROUP).toBe('notifications.alerting.grafana.app');
  });

  // These assertions exist to lock in the centralization. Since the unified mock handlers and
  // factories pull `API_GROUP` / `API_VERSION` from the dispatcher (this module), they must
  // produce v0alpha1 URLs when the toggle is off and v1beta1 URLs when on. If a future change
  // accidentally hardcodes a version inside the handler files, these tests fail loudly instead
  // of silently registering against the wrong path at runtime.
  describe('mock handlers follow the dispatcher', () => {
    it('listReceiverHandler URL matches v0alpha1 when toggle is off', async () => {
      await loadWithToggle(false);
      const { listReceiverHandler } = await import('./mocks/handlers/ReceiverHandlers/listReceiverHandler');
      expect(listReceiverHandler({ kind: 'ReceiverList', metadata: {}, items: [] }).info.path).toBe(
        '/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers'
      );
    });

    it('listReceiverHandler URL matches v1beta1 when toggle is on', async () => {
      await loadWithToggle(true);
      const { listReceiverHandler } = await import('./mocks/handlers/ReceiverHandlers/listReceiverHandler');
      expect(listReceiverHandler({ kind: 'ReceiverList', metadata: {}, items: [] }).info.path).toBe(
        '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/receivers'
      );
    });

    it('listRoutingTreeHandler URL matches v0alpha1 when toggle is off', async () => {
      await loadWithToggle(false);
      const { listRoutingTreeHandler } = await import('./mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler');
      expect(listRoutingTreeHandler({ kind: 'RoutingTreeList', metadata: {}, items: [] }).info.path).toBe(
        '/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/routingtrees'
      );
    });

    it('listRoutingTreeHandler URL matches v1beta1 when toggle is on', async () => {
      await loadWithToggle(true);
      const { listRoutingTreeHandler } = await import('./mocks/handlers/RoutingTreeHandlers/listRoutingTreeHandler');
      expect(listRoutingTreeHandler({ kind: 'RoutingTreeList', metadata: {}, items: [] }).info.path).toBe(
        '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/routingtrees'
      );
    });

    it('ContactPointFactory emits the toggle-matching apiVersion (off → v0alpha1)', async () => {
      await loadWithToggle(false);
      const { ContactPointFactory } = await import('./mocks/fakes/Receivers');
      expect(ContactPointFactory.build().apiVersion).toBe('notifications.alerting.grafana.app/v0alpha1');
    });

    it('ContactPointFactory emits the toggle-matching apiVersion (on → v1beta1)', async () => {
      await loadWithToggle(true);
      const { ContactPointFactory } = await import('./mocks/fakes/Receivers');
      expect(ContactPointFactory.build().apiVersion).toBe('notifications.alerting.grafana.app/v1beta1');
    });
  });
});
