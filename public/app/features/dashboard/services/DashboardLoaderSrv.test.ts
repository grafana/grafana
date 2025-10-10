import { getBackendSrv } from '@grafana/runtime';

import { DashboardLoaderSrv } from './DashboardLoaderSrv';

// Mock dependencies
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
  locationService: {
    getSearchObject: jest.fn(() => ({})),
  },
  config: {
    bootData: { user: {}, settings: {}, navTree: [] },
  },
}));

jest.mock('../../../core/core', () => ({
  appEvents: {
    emit: jest.fn(),
  },
}));

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: jest.fn(() => ({})),
}));

jest.mock('./DashboardSrv', () => ({
  getDashboardSrv: jest.fn(() => ({})),
}));

// Mock additional dependencies to prevent import errors
jest.mock('app/core/services/backend_srv', () => ({ backendSrv: {} }));
jest.mock('app/core/services/impression_srv', () => ({ default: { addDashboardImpression: jest.fn() } }));
jest.mock('app/features/dashboard-scene/pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(() => ({ getDashboardFromCache: jest.fn() })),
}));
jest.mock('../api/dashboard_api', () => ({ getDashboardAPI: jest.fn(() => ({ getDashboardDTO: jest.fn() })) }));
jest.mock('../api/ResponseTransformers', () => ({ ResponseTransformers: { ensureV2Response: jest.fn() } }));
jest.mock('./SnapshotSrv', () => ({ getDashboardSnapshotSrv: jest.fn(() => ({ getSnapshot: jest.fn() })) }));
jest.mock('app/core/utils/kbn', () => ({}));
jest.mock('moment', () => jest.fn());
jest.mock('lodash', () => ({ isFunction: jest.fn() }));
jest.mock('@grafana/data', () => ({ AppEvents: { alertError: 'alert-error' }, dateMath: {} }));

// Mock global Date to control timestamp
const mockDate = new Date('2023-01-01T00:00:00.000Z');
const originalDate = global.Date;

describe('DashboardLoaderSrv - loadScriptedDashboard fetch', () => {
  let dashboardLoaderSrv: DashboardLoaderSrv;
  let mockBackendSrv: { get: jest.MockedFunction<(...args: unknown[]) => Promise<string>> };

  beforeEach(() => {
    dashboardLoaderSrv = new DashboardLoaderSrv();
    mockBackendSrv = {
      get: jest.fn(),
    };

    (getBackendSrv as jest.Mock).mockReturnValue(mockBackendSrv);

    // Mock Date constructor
    global.Date = jest.fn(() => mockDate) as unknown as DateConstructor;
    global.Date.now = jest.fn(() => mockDate.getTime());
    Object.setPrototypeOf(global.Date, originalDate);
    Object.assign(global.Date, originalDate);

    jest.clearAllMocks();
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  describe('backend service fetch', () => {
    it('should call backend service with correct URL and parameters', async () => {
      const fileName = 'test-dashboard.js';
      mockBackendSrv.get.mockResolvedValue('return { title: "Test Dashboard" };');

      await dashboardLoaderSrv['loadScriptedDashboard'](fileName);

      expect(mockBackendSrv.get).toHaveBeenCalledTimes(1);
      expect(mockBackendSrv.get).toHaveBeenCalledWith(
        `public/dashboards/${fileName}?${mockDate.getTime()}`,
        undefined,
        undefined,
        { validatePath: true }
      );
    });

    it('should include timestamp in URL to prevent caching', async () => {
      const fileName = 'cached-dashboard.js';
      mockBackendSrv.get.mockResolvedValue('return { title: "Dashboard" };');

      await dashboardLoaderSrv['loadScriptedDashboard'](fileName);

      const [url] = mockBackendSrv.get.mock.calls[0];
      expect(url).toMatch(/\?1672531200000$/); // timestamp from mockDate
    });

    it('should include validatePath security option', async () => {
      const fileName = 'secure-dashboard.js';
      mockBackendSrv.get.mockResolvedValue('return { title: "Dashboard" };');

      await dashboardLoaderSrv['loadScriptedDashboard'](fileName);

      const [, , , options] = mockBackendSrv.get.mock.calls[0];
      expect(options).toEqual({ validatePath: true });
    });

    it('should reject invalid file names without calling backend', async () => {
      await expect(dashboardLoaderSrv['loadScriptedDashboard']('../invalid.js')).rejects.toThrow('Invalid script name');

      expect(mockBackendSrv.get).not.toHaveBeenCalled();
    });

    it('should reject .txt files', async () => {
      await expect(dashboardLoaderSrv['loadScriptedDashboard']('file.txt')).rejects.toThrow('Invalid script name');

      expect(mockBackendSrv.get).not.toHaveBeenCalled();
    });

    it('should reject absolute paths', async () => {
      await expect(dashboardLoaderSrv['loadScriptedDashboard']('/a/file.js')).rejects.toThrow('Invalid script name');

      expect(mockBackendSrv.get).not.toHaveBeenCalled();
    });
  });
});
