import { dashboardSceneJsonApiV2 } from './runtimeDashboardSceneJsonApiV2';

jest.mock('./currentDashboardKindV2', () => ({
  getCurrentDashboardKindV2: jest.fn(),
}));

jest.mock('./currentDashboardSpecApplyV2', () => ({
  applyCurrentDashboardSpecV2: jest.fn(),
}));

describe('dashboardSceneJsonApiV2 (runtime adapter)', () => {
  const { getCurrentDashboardKindV2 } = jest.requireMock('./currentDashboardKindV2');
  const { applyCurrentDashboardSpecV2 } = jest.requireMock('./currentDashboardSpecApplyV2');

  const baseResource = {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Dashboard',
    metadata: { name: 'dash-uid', namespace: 'default' },
    spec: { title: 'x' },
    status: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/d/dash-uid/slug');
  });

  it('getCurrentDashboard returns cached JSON if live serialization fails', () => {
    getCurrentDashboardKindV2.mockReturnValue(baseResource);
    const first = dashboardSceneJsonApiV2.getCurrentDashboard(0);
    expect(JSON.parse(first).metadata.name).toBe('dash-uid');

    getCurrentDashboardKindV2.mockImplementation(() => {
      throw new Error('Unsupported transformation type');
    });
    const second = dashboardSceneJsonApiV2.getCurrentDashboard(0);
    expect(second).toBe(first);
  });

  it('applyCurrentDashboard uses cached baseline to enforce immutability if live serialization fails', () => {
    // Prime cache
    getCurrentDashboardKindV2.mockReturnValue(baseResource);
    dashboardSceneJsonApiV2.getCurrentDashboard(0);

    // Now break live serialization
    getCurrentDashboardKindV2.mockImplementation(() => {
      throw new Error('Unsupported transformation type');
    });

    expect(() =>
      dashboardSceneJsonApiV2.applyCurrentDashboard(
        JSON.stringify({
          ...baseResource,
          apiVersion: 'dashboard.grafana.app/v2alpha1',
        })
      )
    ).toThrow('Changing apiVersion is not allowed');
  });

  it('applyCurrentDashboard can recover without a baseline by validating against URL UID and applying spec', () => {
    getCurrentDashboardKindV2.mockImplementation(() => {
      throw new Error('Unsupported transformation type');
    });

    const nextSpec = { title: 'recovered' };
    dashboardSceneJsonApiV2.applyCurrentDashboard(
      JSON.stringify({
        ...baseResource,
        spec: nextSpec,
      })
    );

    expect(applyCurrentDashboardSpecV2).toHaveBeenCalledWith(nextSpec);
  });

  it('applyCurrentDashboard rejects recovery attempts targeting a different dashboard UID', () => {
    getCurrentDashboardKindV2.mockImplementation(() => {
      throw new Error('Unsupported transformation type');
    });

    expect(() =>
      dashboardSceneJsonApiV2.applyCurrentDashboard(
        JSON.stringify({
          ...baseResource,
          metadata: { ...baseResource.metadata, name: 'other-uid' },
        })
      )
    ).toThrow('Changing metadata is not allowed');
  });
});


