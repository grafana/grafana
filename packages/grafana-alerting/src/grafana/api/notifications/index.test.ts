// The switching module reads the feature toggle at import time. To exercise both branches
// without restructuring production code, each test resets the Jest module registry and then
// re-requires `@grafana/runtime` and the switching module together so they share the same
// `config` instance and the toggle value is observed during module init.

describe('notifications switching layer', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function loadWithToggle(enabled: boolean) {
    const runtime = require('@grafana/runtime');
    runtime.config.featureToggles['alerting.notificationsAPIV1Beta1'] = enabled;
    return require('./index');
  }

  it('resolves to v0alpha1 by default (toggle off)', () => {
    const { notificationsAPI, API_VERSION } = loadWithToggle(false);
    expect(API_VERSION).toBe('v0alpha1');
    expect(notificationsAPI.reducerPath).toBe('notificationsAlertingAPIv0alpha1');
  });

  it('resolves to v1beta1 when toggle is enabled', () => {
    const { notificationsAPI, API_VERSION } = loadWithToggle(true);
    expect(API_VERSION).toBe('v1beta1');
    expect(notificationsAPI.reducerPath).toBe('notificationsAlertingAPIv1beta1');
  });

  it('exposes the same API_GROUP regardless of toggle', () => {
    const v0 = loadWithToggle(false);
    jest.resetModules();
    const v1 = loadWithToggle(true);
    expect(v0.API_GROUP).toBe('notifications.alerting.grafana.app');
    expect(v1.API_GROUP).toBe('notifications.alerting.grafana.app');
  });
});
