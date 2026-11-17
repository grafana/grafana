import { backendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';

import { DashboardLoaderSrvV2 } from './DashboardLoaderSrv';
import { getDashboardSnapshotSrv } from './SnapshotSrv';

jest.mock('app/core/services/backend_srv', () => ({
  backendSrv: { getPublicDashboardByUid: jest.fn() },
}));

jest.mock('app/core/services/impression_srv', () => ({
  __esModule: true,
  default: { addDashboardImpression: jest.fn() },
}));

jest.mock('./SnapshotSrv', () => ({
  getDashboardSnapshotSrv: jest.fn(),
}));

jest.mock('app/features/dashboard-scene/pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: () => ({ getDashboardFromCache: jest.fn() }),
}));

jest.mock('../api/ResponseTransformers', () => ({
  ResponseTransformers: { ensureV2Response: jest.fn((r) => r) },
}));

const v2Response = { metadata: { name: 'dash-uid' } };

describe('DashboardLoaderSrvV2', () => {
  let warnSpy: jest.SpyInstance;
  const addImpression = jest.mocked(impressionSrv.addDashboardImpression);

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('loadDashboard', () => {
    it('records an impression and resolves with the dashboard', async () => {
      jest.mocked(backendSrv.getPublicDashboardByUid).mockResolvedValue(v2Response as never);

      const result = await new DashboardLoaderSrvV2().loadDashboard('public', undefined, 'public-uid');

      expect(result).toBe(v2Response);
      expect(addImpression).toHaveBeenCalledWith('dash-uid');
    });

    it('still resolves with the dashboard when recording the impression throws', async () => {
      jest.mocked(backendSrv.getPublicDashboardByUid).mockResolvedValue(v2Response as never);
      const error = new Error('storage unavailable');
      addImpression.mockImplementationOnce(() => {
        throw error;
      });

      const result = await new DashboardLoaderSrvV2().loadDashboard('public', undefined, 'public-uid');

      expect(result).toBe(v2Response);
      expect(warnSpy).toHaveBeenCalledWith('Failed to record dashboard impression: ', error);
    });

    it('rejects the returned promise when the load fails, without recording an impression', async () => {
      const error = new Error('load failed');
      jest.mocked(backendSrv.getPublicDashboardByUid).mockRejectedValue(error);

      await expect(new DashboardLoaderSrvV2().loadDashboard('public', undefined, 'public-uid')).rejects.toBe(error);

      expect(addImpression).not.toHaveBeenCalled();
    });
  });

  describe('loadSnapshot', () => {
    const mockSnapshot = (impl: () => Promise<unknown>) =>
      jest.mocked(getDashboardSnapshotSrv).mockReturnValue({ getSnapshot: jest.fn(impl) } as never);

    it('records an impression and resolves with the snapshot', async () => {
      mockSnapshot(() => Promise.resolve(v2Response));

      const result = await new DashboardLoaderSrvV2().loadSnapshot('snap-key');

      expect(result).toBe(v2Response);
      expect(addImpression).toHaveBeenCalledWith('dash-uid');
    });

    it('still resolves with the snapshot when recording the impression throws', async () => {
      mockSnapshot(() => Promise.resolve(v2Response));
      const error = new Error('storage unavailable');
      addImpression.mockImplementationOnce(() => {
        throw error;
      });

      const result = await new DashboardLoaderSrvV2().loadSnapshot('snap-key');

      expect(result).toBe(v2Response);
      expect(warnSpy).toHaveBeenCalledWith('Failed to record snapshot impression: ', error);
    });

    it('rejects when the snapshot fails to load, without recording an impression', async () => {
      const error = new Error('not found');
      mockSnapshot(() => Promise.reject(error));

      await expect(new DashboardLoaderSrvV2().loadSnapshot('snap-key')).rejects.toBe(error);

      expect(addImpression).not.toHaveBeenCalled();
    });
  });
});
