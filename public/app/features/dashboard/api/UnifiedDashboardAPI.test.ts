import { Dashboard } from '@grafana/schema/dist/esm/index';
import {
  Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { ResourceList } from 'app/features/apiserver/types';
import { DashboardDataDTO, DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { DashboardVersionError, DashboardWithAccessInfo } from './types';
import { isV2DashboardCommand } from './utils';
import { K8sDashboardAPI } from './v1';
import { K8sDashboardV2API } from './v2';

jest.mock('./v1');
jest.mock('./v2');

let mockBackendSrvGet = {};

// Mocking just for the sake of not importing the entire universe.
// backendSrv.getFolderByUid is used in the v2 client
jest.mock('app/core/services/backend_srv', () => {
  return {
    backendSrv: {},
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn(() => {
      return new Promise((resolve) => {
        resolve(mockBackendSrvGet);
      });
    }),
  }),
}));

describe('UnifiedDashboardAPI', () => {
  let api: UnifiedDashboardAPI;
  let v1Client: jest.Mocked<K8sDashboardAPI>;
  let v2Client: jest.Mocked<K8sDashboardV2API>;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new UnifiedDashboardAPI();
    v1Client = api['v1Client'] as jest.Mocked<K8sDashboardAPI>;
    v2Client = api['v2Client'] as jest.Mocked<K8sDashboardV2API>;
  });

  describe('getDashboardDTO', () => {
    it('should try v1 first and return result if successful', async () => {
      const mockResponse = { dashboard: { title: 'test' } };
      v1Client.getDashboardDTO.mockResolvedValue(mockResponse as DashboardDTO);

      const result = await api.getDashboardDTO('123');

      expect(result).toBe(mockResponse);
      expect(v1Client.getDashboardDTO).toHaveBeenCalledWith('123');
      expect(v2Client.getDashboardDTO).not.toHaveBeenCalled();
    });

    it('should fallback to v2 if v1 throws DashboardVersionError', async () => {
      const mockV2Response = { spec: { title: 'test' } };
      v1Client.getDashboardDTO.mockRejectedValue(new DashboardVersionError('v2alpha1', 'Dashboard is V1 format'));
      v2Client.getDashboardDTO.mockResolvedValue(mockV2Response as DashboardWithAccessInfo<DashboardV2Spec>);

      const result = await api.getDashboardDTO('123');

      expect(result).toBe(mockV2Response);
      expect(v2Client.getDashboardDTO).toHaveBeenCalledWith('123');
    });

    it('should return v2 even if there is a conversion error', async () => {
      const mockV2Response = {
        spec: defaultDashboardV2Spec(),
        status: {
          conversion: {
            failed: true,
            storedVersion: 'v0alpha1',
            error: 'backend conversion not yet implemented',
          },
        },
        metadata: {
          annotations: {},
        },
      };

      v1Client.getDashboardDTO.mockRejectedValue(new DashboardVersionError('v2alpha1', 'Dashboard is V1 format'));
      v2Client.getDashboardDTO.mockImplementation((params) => {
        const actualClient = jest.requireActual('./v2').K8sDashboardV2API;
        const client = new actualClient();
        return client.getDashboardDTO(params);
      });
      mockBackendSrvGet = mockV2Response;
      const result = await api.getDashboardDTO('123');
      expect(result).toEqual(mockV2Response);
      expect(v2Client.getDashboardDTO).toHaveBeenCalledWith('123');
    });
  });

  describe('saveDashboard', () => {
    it('should use v1 client for v1 dashboard', async () => {
      const mockCommand = { dashboard: { title: 'test' } };
      v1Client.saveDashboard.mockResolvedValue({ id: 1, status: 'success', slug: '', uid: '', url: '', version: 1 });

      await api.saveDashboard(mockCommand as SaveDashboardCommand<Dashboard>);

      expect(v1Client.saveDashboard).toHaveBeenCalledWith(mockCommand);
      expect(v2Client.saveDashboard).not.toHaveBeenCalled();
    });

    it('should use v2 client for v2 dashboard', async () => {
      const mockCommand: SaveDashboardCommand<DashboardV2Spec> = {
        dashboard: {
          title: 'test',
          elements: {},
          annotations: [],
          cursorSync: 'Crosshair',
          layout: {
            kind: 'GridLayout',
            spec: { items: [] },
          },
          liveNow: false,
          tags: [],
          links: [],
          preload: false,
          timeSettings: {
            from: 'now-1h',
            to: 'now',
            autoRefresh: '5s',
            autoRefreshIntervals: ['5s', '1m', '5m', '15m', '30m', '1h', '4h', '8h', '12h', '24h'],
            timezone: 'utc',
            hideTimepicker: false,
            fiscalYearStartMonth: 0,
          },
          variables: [],
        },
      };

      v2Client.saveDashboard.mockResolvedValue({ id: 1, status: 'success', slug: '', uid: '', url: '', version: 1 });

      await api.saveDashboard(mockCommand as SaveDashboardCommand<DashboardV2Spec>);

      expect(isV2DashboardCommand(mockCommand)).toBe(true);
      expect(v2Client.saveDashboard).toHaveBeenCalledWith(mockCommand);
      expect(v1Client.saveDashboard).not.toHaveBeenCalled();
    });
  });

  describe('deleteDashboard', () => {
    it('should not try other version if fails', async () => {
      v1Client.deleteDashboard.mockRejectedValue(new DashboardVersionError('v2alpha1', 'Dashboard is V1 format'));

      try {
        await api.deleteDashboard('123', true);
      } catch (error) {}
      expect(v1Client.deleteDashboard).toHaveBeenCalledWith('123', true);
      expect(v2Client.deleteDashboard).not.toHaveBeenCalled();
    });
  });

  describe('listDeletedDashboards', () => {
    it('should try v1 first and return result if successful', async () => {
      const mockV1Response = {
        items: [
          { spec: { title: 'deleted-dash-1' }, metadata: { name: 'dash-1' } },
          { spec: { title: 'deleted-dash-2' }, metadata: { name: 'dash-2' } },
        ],
      };
      v1Client.listDeletedDashboards.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);

      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(result).toBe(mockV1Response);
      expect(v1Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10 });
      expect(v2Client.listDeletedDashboards).not.toHaveBeenCalled();
    });

    it('should fallback to v2 if v1 returns items with null specs', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: {
          resourceVersion: '123',
          creationTimestamp: '2023-01-01T00:00:00Z',
        },
        items: [
          {
            apiVersion: 'dashboard.grafana.app/v1beta1',
            kind: 'Dashboard',
            spec: null,
            metadata: { name: 'dash-1', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
          },
          {
            apiVersion: 'dashboard.grafana.app/v1beta1',
            kind: 'Dashboard',
            spec: null,
            metadata: { name: 'dash-2', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
          },
          {
            apiVersion: 'dashboard.grafana.app/v1beta1',
            kind: 'Dashboard',
            spec: null,
            metadata: { name: 'dash-2', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
          },
        ],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2alpha1',
        kind: 'DashboardList',
        metadata: {
          resourceVersion: '123',
          creationTimestamp: '2023-01-01T00:00:00Z',
        },
        items: [
          {
            apiVersion: 'dashboard.grafana.app/v2alpha1',
            kind: 'Dashboard',
            spec: defaultDashboardV2Spec(),
            metadata: { name: 'dash-1', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
          },
          {
            apiVersion: 'dashboard.grafana.app/v2alpha1',
            kind: 'Dashboard',
            spec: defaultDashboardV2Spec(),
            metadata: { name: 'dash-2', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
          },
        ],
      };

      // @ts-expect-error - specs are null
      v1Client.listDeletedDashboards.mockResolvedValue(mockV1Response);
      v2Client.listDeletedDashboards.mockResolvedValue(mockV2Response);

      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(result).toBe(mockV2Response);
      expect(v1Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10 });
      expect(v2Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10 });
    });

    it('should fallback to v2 if v1 throws DashboardVersionError', async () => {
      const mockV2Response = {
        items: [{ spec: defaultDashboardV2Spec(), metadata: { name: 'dash-1' } }],
      };

      v1Client.listDeletedDashboards.mockRejectedValue(new DashboardVersionError('unsupported version'));
      v2Client.listDeletedDashboards.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(result).toBe(mockV2Response);
      expect(v2Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10 });
    });

    it('should throw non-DashboardVersionError from v1', async () => {
      const mockError = new Error('Network error');
      v1Client.listDeletedDashboards.mockRejectedValue(mockError);

      await expect(api.listDeletedDashboards({ limit: 10 })).rejects.toThrow('Network error');
      expect(v2Client.listDeletedDashboards).not.toHaveBeenCalled();
    });
  });

  describe('restoreDashboard', () => {
    it('should use v1 client for v1 dashboard resource', async () => {
      const mockV1Dashboard = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'Dashboard',
        metadata: {
          name: 'dash-1',
          resourceVersion: '123',
          creationTimestamp: '2023-01-01T00:00:00Z',
        },
        spec: { title: 'V1 Dashboard', panels: [], schemaVersion: 30, uid: '123' },
      };
      const mockResponse = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'Dashboard',
        metadata: {
          name: 'dash-1',
          resourceVersion: '123',
          creationTimestamp: '2023-01-01T00:00:00Z',
          uid: '123',
        },
        spec: mockV1Dashboard.spec,
      };

      v1Client.restoreDashboard.mockResolvedValue(mockResponse);

      const result = await api.restoreDashboard(mockV1Dashboard);

      expect(result).toBe(mockResponse);
      expect(v1Client.restoreDashboard).toHaveBeenCalledWith(mockV1Dashboard);
      expect(v2Client.restoreDashboard).not.toHaveBeenCalled();
    });

    it('should use v2 client for v2 dashboard resource', async () => {
      const mockV2Dashboard = {
        apiVersion: 'dashboard.grafana.app/v2alpha1',
        kind: 'Dashboard',
        metadata: {
          name: 'dash-1',
          resourceVersion: '123',
          creationTimestamp: '2023-01-01T00:00:00Z',
        },
        spec: {
          ...defaultDashboardV2Spec(),
          title: 'V2 Dashboard',
        },
      };
      const mockResponse = {
        apiVersion: 'dashboard.grafana.app/v2alpha1',
        kind: 'Dashboard',
        metadata: {
          name: 'dash-1',
          resourceVersion: '123',
          creationTimestamp: '2023-01-01T00:00:00Z',
        },
        spec: mockV2Dashboard.spec,
      };

      v2Client.restoreDashboard.mockResolvedValue(mockResponse);

      const result = await api.restoreDashboard(mockV2Dashboard);

      expect(result).toBe(mockResponse);
      expect(v2Client.restoreDashboard).toHaveBeenCalledWith(mockV2Dashboard);
      expect(v1Client.restoreDashboard).not.toHaveBeenCalled();
    });

    it('should throw error for invalid dashboard resource', async () => {
      const invalidDashboard = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'Dashboard',
        metadata: { name: 'dash-1' },
        spec: { invalid: 'data' },
      };

      // @ts-expect-error - Invalid dashboard for testing
      await expect(api.restoreDashboard(invalidDashboard)).rejects.toThrow(
        'Invalid dashboard resource for restore operation'
      );
      expect(v1Client.restoreDashboard).not.toHaveBeenCalled();
      expect(v2Client.restoreDashboard).not.toHaveBeenCalled();
    });

    it('should throw error for dashboard resource without metadata', async () => {
      const invalidDashboard = {
        spec: { title: 'Dashboard' },
      };

      // @ts-expect-error - Invalid dashboard for testing
      await expect(api.restoreDashboard(invalidDashboard)).rejects.toThrow(
        'Invalid dashboard resource for restore operation'
      );
    });
  });
});
