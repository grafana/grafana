import { getBackendSrv } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';
import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { getDashboardAPI, setDashboardAPI } from './dashboard_api';
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
  dashboardAPIVersionResolver.set({ v1: 'v1beta1', v2: 'v2beta1' });
});

afterAll(() => {
  dashboardAPIVersionResolver.reset();
});

describe('DashboardApi', () => {
  it('should use unified api by default', async () => {
    expect(await getDashboardAPI()).toBeInstanceOf(UnifiedDashboardAPI);
  });

  it('should allow overriding clients in test environment', async () => {
    process.env.NODE_ENV = 'test';
    const mockClient = { unified: new UnifiedDashboardAPI() };
    setDashboardAPI(mockClient);
    const api = await getDashboardAPI();
    expect(api).toBe(mockClient.unified);
    setDashboardAPI(undefined);
  });

  it('should return v1 if it is passed in the params', async () => {
    expect(await getDashboardAPI('v1')).toBeInstanceOf(K8sDashboardAPI);
  });

  it('should return v2 if it is passed in the params', async () => {
    expect(await getDashboardAPI('v2')).toBeInstanceOf(K8sDashboardV2API);
  });

  describe('when dashboardNewLayouts enabled', () => {
    beforeEach(() => {
      setTestFlags({ dashboardNewLayouts: true });
    });

    it('should use v2 when v2 is passed in the params', async () => {
      expect(await getDashboardAPI('v2')).toBeInstanceOf(K8sDashboardV2API);
    });
  });

  describe('client rebuild after transient discovery failure', () => {
    beforeEach(() => {
      dashboardAPIVersionResolver.reset();
      setDashboardAPI(undefined);
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
