import { defaultSpec as defaultDashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { getCurrentDashboardKindV2 } from './currentDashboardKindV2';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      kubernetesDashboards: true,
      kubernetesDashboardsV2: true,
      dashboardNewLayouts: false,
    },
  },
}));

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

describe('getCurrentDashboardKindV2', () => {
  const { getDashboardScenePageStateManager } = jest.requireMock('../pages/DashboardScenePageStateManager');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns v2beta1 Dashboard kind JSON for the currently open dashboard', () => {
    const spec = defaultDashboardV2Spec();

    const dashboard = {
      state: {
        uid: 'dash-uid',
        meta: {
          k8s: {
            name: 'dash-uid',
            resourceVersion: '1',
            creationTimestamp: 'now',
            annotations: {},
            labels: {},
          },
        },
      },
      getSaveResource: () => ({
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'Dashboard',
        metadata: { name: 'dash-uid' },
        spec,
      }),
    };

    getDashboardScenePageStateManager.mockReturnValue({
      state: { dashboard },
    });

    const res = getCurrentDashboardKindV2();
    expect(res.apiVersion).toBe('dashboard.grafana.app/v2beta1');
    expect(res.kind).toBe('Dashboard');
    expect(res.metadata.name).toBe('dash-uid');
    expect(res.spec).toBe(spec);
  });

  it('throws if no dashboard is currently open', () => {
    getDashboardScenePageStateManager.mockReturnValue({ state: { dashboard: undefined } });
    expect(() => getCurrentDashboardKindV2()).toThrow('No dashboard is currently open');
  });
});


