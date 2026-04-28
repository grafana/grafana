import { config, getBackendSrv } from '@grafana/runtime';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';
import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { getDashboardAPI, setDashboardAPI } from './dashboard_api';
import { LegacyDashboardAPI } from './legacy';
import { K8sDashboardAPI, getK8sV1DashboardApiConfig } from './v1';
import { K8sDashboardV2API, getK8sV2DashboardApiConfig } from './v2';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;

function mockDiscoveryResponse(versions: string[]) {
  mockGetBackendSrv.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      name: 'dashboard.grafana.app',
      versions: versions.map((v) => ({ groupVersion: `dashboard.grafana.app/${v}`, version: v })),
      preferredVersion: { groupVersion: `dashboard.grafana.app/${versions[0]}`, version: versions[0] },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function mockDiscoveryFailure() {
  mockGetBackendSrv.mockReturnValue({
    get: jest.fn().mockRejectedValue(new Error('Network error')),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeAll(() => {
  config.featureToggles.kubernetesDashboards = false;
  dashboardAPIVersionResolver.set({ v1: 'v1beta1', v2: 'v2beta1' });
});

afterAll(() => {
  dashboardAPIVersionResolver.reset();
});

describe('DashboardApi', () => {
  it('should use legacy api by default', async () => {
    expect(await getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
  });

  it('should allow overriding clients in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const mockClient = { legacy: new LegacyDashboardAPI() };
    setDashboardAPI(mockClient);
    const api = await getDashboardAPI();
    expect(api).toBe(mockClient.legacy);
    setDashboardAPI(undefined);
  });

  describe('when scenes enabled', () => {
    it('should use legacy api kubernetesDashboards toggle is disabled', async () => {
      config.featureToggles.kubernetesDashboards = false;
      expect(await getDashboardAPI()).toBeInstanceOf(LegacyDashboardAPI);
    });

    it('should use legacy when v1 is passed and kubernetesDashboards toggle is disabled', async () => {
      config.featureToggles.kubernetesDashboards = false;
      expect(await getDashboardAPI('v1')).toBeInstanceOf(LegacyDashboardAPI);
    });

    it('should use unified api when and kubernetesDashboards toggle is enabled', async () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(await getDashboardAPI()).toBeInstanceOf(UnifiedDashboardAPI);
    });

    it('should return v1 if it is passed in the params', async () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(await getDashboardAPI('v1')).toBeInstanceOf(K8sDashboardAPI);
    });

    it('should return v2 if it is passed in the params', async () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(await getDashboardAPI('v2')).toBeInstanceOf(K8sDashboardV2API);
    });

    it('should throw an error if v2 is passed in the params and kubernetesDashboards toggle is disabled', async () => {
      config.featureToggles.kubernetesDashboards = false;
      await expect(getDashboardAPI('v2')).rejects.toThrow('v2 is not supported if kubernetes dashboards are disabled');
    });
  });

  describe('when dashboardNewLayouts enabled', () => {
    beforeEach(() => {
      config.featureToggles.dashboardNewLayouts = true;
    });

    it('should use v2 when v2 is passed in the params', async () => {
      config.featureToggles.kubernetesDashboards = true;
      expect(await getDashboardAPI('v2')).toBeInstanceOf(K8sDashboardV2API);
    });
  });

  describe('client rebuild after transient discovery failure', () => {
    beforeEach(() => {
      dashboardAPIVersionResolver.reset();
      setDashboardAPI(undefined);
      config.featureToggles.kubernetesDashboards = true;
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      dashboardAPIVersionResolver.reset();
      setDashboardAPI(undefined);
    });

    it('should rebuild clients with correct versions after discovery recovers', async () => {
      // First call: discovery fails → clients built with beta fallback
      mockDiscoveryFailure();
      await getDashboardAPI('v2');
      expect(getK8sV2DashboardApiConfig().version).toBe('v2beta1');

      // Second call: discovery succeeds → clients rebuilt with stable versions
      mockDiscoveryResponse(['v2', 'v1']);
      await getDashboardAPI('v2');
      expect(getK8sV2DashboardApiConfig().version).toBe('v2');
      expect(getK8sV1DashboardApiConfig().version).toBe('v1');
    });
  });
});
