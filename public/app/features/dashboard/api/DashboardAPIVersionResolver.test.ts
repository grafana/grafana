import { getBackendSrv } from '@grafana/runtime';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;

const BETA_FALLBACK = { v1: 'v1beta1', v2: 'v2beta1' };

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

describe('DashboardAPIVersionResolver', () => {
  beforeEach(() => {
    dashboardAPIVersionResolver.reset();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  describe('resolve', () => {
    it.each([
      { versions: ['v2', 'v2beta1', 'v1', 'v1beta1'], expected: { v1: 'v1', v2: 'v2beta1' }, desc: 'both stable' },
      { versions: ['v2beta1', 'v1beta1'], expected: BETA_FALLBACK, desc: 'beta only' },
      { versions: ['v2beta1', 'v1', 'v1beta1'], expected: { v1: 'v1', v2: 'v2beta1' }, desc: 'v1 stable only' },
      { versions: ['v2', 'v2beta1', 'v1beta1'], expected: { v1: 'v1beta1', v2: 'v2beta1' }, desc: 'v2 stable only' },
    ])('should resolve correctly when $desc are available', async ({ versions, expected }) => {
      mockDiscoveryResponse(versions);

      const result = await dashboardAPIVersionResolver.resolve();

      expect(result).toEqual(expected);
    });

    it('should call discovery endpoint with showErrorAlert disabled', async () => {
      mockDiscoveryResponse(['v2beta1', 'v1beta1']);
      await dashboardAPIVersionResolver.resolve();

      const mockGet = mockGetBackendSrv()?.get as jest.Mock;
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/apis/dashboard.grafana.app/'),
        undefined,
        undefined,
        expect.objectContaining({ showErrorAlert: false })
      );
    });

    it('should retry discovery after a transient failure', async () => {
      mockDiscoveryFailure();
      expect(await dashboardAPIVersionResolver.resolve()).toEqual(BETA_FALLBACK);

      mockDiscoveryResponse(['v2', 'v1']);
      expect(await dashboardAPIVersionResolver.resolve()).toEqual({ v1: 'v1', v2: 'v2beta1' });
    });

    it('should cache and deduplicate concurrent resolve calls', async () => {
      mockDiscoveryResponse(['v2', 'v1']);

      const [r1, r2, r3] = await Promise.all([
        dashboardAPIVersionResolver.resolve(),
        dashboardAPIVersionResolver.resolve(),
        dashboardAPIVersionResolver.resolve(),
      ]);

      const expected = { v1: 'v1', v2: 'v2beta1' };
      expect(r1).toEqual(expected);
      expect(r2).toEqual(expected);
      expect(r3).toEqual(expected);

      const mockGet = mockGetBackendSrv()?.get as jest.Mock;
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Subsequent call uses cache
      await dashboardAPIVersionResolver.resolve();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should return fallback to all concurrent callers on failure', async () => {
      mockDiscoveryFailure();

      const [r1, r2, r3] = await Promise.all([
        dashboardAPIVersionResolver.resolve(),
        dashboardAPIVersionResolver.resolve(),
        dashboardAPIVersionResolver.resolve(),
      ]);

      expect(r1).toEqual(BETA_FALLBACK);
      expect(r2).toEqual(BETA_FALLBACK);
      expect(r3).toEqual(BETA_FALLBACK);
    });

    describe('debug logging', () => {
      beforeEach(() => localStorage.setItem('grafana.debug.dashboardAPI', 'true'));
      afterEach(() => localStorage.removeItem('grafana.debug.dashboardAPI'));

      it('should log resolved versions', async () => {
        mockDiscoveryResponse(['v2', 'v1']);
        await dashboardAPIVersionResolver.resolve();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Version negotiation'));
      });

      it('should log on discovery failure', async () => {
        mockDiscoveryFailure();
        await dashboardAPIVersionResolver.resolve();
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('discovery failed'), expect.any(Error));
      });
    });

    it('should not log when debug is disabled', async () => {
      localStorage.removeItem('grafana.debug.dashboardAPI');
      mockDiscoveryResponse(['v2', 'v1']);
      await dashboardAPIVersionResolver.resolve();
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('getV1 / getV2', () => {
    it('should return beta defaults before resolve is called', () => {
      expect(dashboardAPIVersionResolver.getV1()).toBe('v1beta1');
      expect(dashboardAPIVersionResolver.getV2()).toBe('v2beta1');
    });

    it('should return resolved versions after resolve', async () => {
      mockDiscoveryResponse(['v2', 'v1']);
      await dashboardAPIVersionResolver.resolve();
      expect(dashboardAPIVersionResolver.getV1()).toBe('v1');
      expect(dashboardAPIVersionResolver.getV2()).toBe('v2beta1');
    });
  });
});
