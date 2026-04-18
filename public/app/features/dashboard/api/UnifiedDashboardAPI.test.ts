import { type Dashboard } from '@grafana/schema';
import {
  type Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type ResourceList } from 'app/features/apiserver/types';
import { type DashboardDataDTO, type DashboardDTO } from 'app/types/dashboard';

import { type SaveDashboardCommand } from '../components/SaveDashboard/types';

import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { DashboardVersionError, type DashboardWithAccessInfo } from './types';
import { isV2DashboardCommand } from './utils';
import { type K8sDashboardAPI } from './v1';
import { type K8sDashboardV2API } from './v2';

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
      v1Client.getDashboardDTO.mockRejectedValue(new DashboardVersionError('v2beta1', 'Dashboard is V1 format'));
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

      v1Client.getDashboardDTO.mockRejectedValue(new DashboardVersionError('v2beta1', 'Dashboard is V1 format'));
      v2Client.getDashboardDTO.mockResolvedValue(mockV2Response as DashboardWithAccessInfo<DashboardV2Spec>);
      const result = await api.getDashboardDTO('123');
      expect(result).toEqual(mockV2Response);
      expect(v2Client.getDashboardDTO).toHaveBeenCalledWith('123');
    });
  });

  describe('saveDashboard', () => {
    it('should use v1 client for v1 dashboard', async () => {
      const mockCommand = { dashboard: { title: 'test' } };
      v1Client.saveDashboard.mockResolvedValue({ status: 'success', slug: '', uid: '', url: '', version: 1 });

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

      v2Client.saveDashboard.mockResolvedValue({ status: 'success', slug: '', uid: '', url: '', version: 1 });

      await api.saveDashboard(mockCommand as SaveDashboardCommand<DashboardV2Spec>);

      expect(isV2DashboardCommand(mockCommand)).toBe(true);
      expect(v2Client.saveDashboard).toHaveBeenCalledWith(mockCommand);
      expect(v1Client.saveDashboard).not.toHaveBeenCalled();
    });
  });

  describe('listDashboardHistory', () => {
    it('should return v2 history for pure v2 dashboards (no v1 items)', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1', continue: 'v1-token' },
        items: [],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '2', continue: 'v2-token' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '2',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 2,
            },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '1',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 1,
            },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
        ],
      };

      v1Client.listDashboardHistory.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDashboardHistory.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      const result = await api.listDashboardHistory('dash-1');

      expect(v1Client.listDashboardHistory).toHaveBeenCalledWith('dash-1', { limit: 10, continueToken: undefined });
      expect(v2Client.listDashboardHistory).toHaveBeenCalledWith('dash-1', { limit: 10, continueToken: undefined });
      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual(mockV2Response.items);

      const decoded = JSON.parse(atob(result.metadata.continue!));
      expect(decoded).toEqual({ v1: 'v1-token', v2: 'v2-token' });
    });

    it('should return v1 history when all v1 items are valid', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1', continue: 'v1-token' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v1beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '1',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 1,
            },
            spec: { title: 'v1', schemaVersion: 30 },
            status: {},
          },
        ],
      };

      v1Client.listDashboardHistory.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);

      const result = await api.listDashboardHistory('dash-1');

      expect(result.items).toEqual(mockV1Response.items);
      expect(v2Client.listDashboardHistory).not.toHaveBeenCalled();

      const decoded = JSON.parse(atob(result.metadata.continue!));
      expect(decoded).toEqual({ v1: 'v1-token' });
    });

    it('should merge-sort valid items by generation descending for mixed v1/v2 history', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1', continue: 'v1-token' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v1beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '1',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 1,
            },
            spec: { title: 'v1-valid', schemaVersion: 30 },
            status: {},
          },
          {
            metadata: { name: 'dash-1', resourceVersion: '2', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v2beta1', error: 'conversion failed' } },
          },
        ],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '2', continue: 'v2-token' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '2',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 2,
            },
            spec: { title: 'v2-valid', elements: {} },
            status: {},
          },
          {
            metadata: { name: 'dash-1', resourceVersion: '1', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v1beta1', error: 'conversion failed' } },
          },
        ],
      };

      v1Client.listDashboardHistory.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDashboardHistory.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      const result = await api.listDashboardHistory('dash-1');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].metadata.generation).toBe(2);
      expect(result.items[1].metadata.generation).toBe(1);

      const continueToken = result.metadata.continue!;
      const decoded = JSON.parse(atob(continueToken));
      expect(decoded).toEqual({ v1: 'v1-token', v2: 'v2-token' });
    });

    it('should decode composite continue token and pass separate tokens to v1/v2 clients', async () => {
      const compositeToken = btoa(JSON.stringify({ v1: 'v1-page2', v2: 'v2-page2' }));

      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v1beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '3',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 3,
            },
            spec: { title: 'v1', schemaVersion: 30 },
            status: {},
          },
          {
            metadata: { name: 'dash-1', resourceVersion: '4', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v2beta1', error: 'conversion failed' } },
          },
        ],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '2' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '4',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 4,
            },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
        ],
      };

      v1Client.listDashboardHistory.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDashboardHistory.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      await api.listDashboardHistory('dash-1', { limit: 10, continueToken: compositeToken });

      expect(v1Client.listDashboardHistory).toHaveBeenCalledWith('dash-1', { limit: 10, continueToken: 'v1-page2' });
      expect(v2Client.listDashboardHistory).toHaveBeenCalledWith('dash-1', { limit: 10, continueToken: 'v2-page2' });
    });

    it('should return undefined continue when both streams are exhausted', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v1beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '1',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 1,
            },
            spec: { title: 'v1', schemaVersion: 30 },
            status: {},
          },
          {
            metadata: { name: 'dash-1', resourceVersion: '2', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v2beta1', error: 'conversion failed' } },
          },
        ],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '2' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: {
              name: 'dash-1',
              resourceVersion: '2',
              creationTimestamp: '2023-01-01T00:00:00Z',
              generation: 2,
            },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
          {
            metadata: { name: 'dash-1', resourceVersion: '1', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v1beta1', error: 'conversion failed' } },
          },
        ],
      };

      v1Client.listDashboardHistory.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDashboardHistory.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      const result = await api.listDashboardHistory('dash-1');

      expect(result.metadata.continue).toBeUndefined();
    });
  });

  describe('deleteDashboard', () => {
    it('should not try other version if fails', async () => {
      v1Client.deleteDashboard.mockRejectedValue(new DashboardVersionError('v2beta1', 'Dashboard is V1 format'));

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
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1', continue: 'v1-token' },
        items: [
          { spec: { title: 'deleted-dash-1' }, metadata: { name: 'dash-1' } },
          { spec: { title: 'deleted-dash-2' }, metadata: { name: 'dash-2' } },
        ],
      };
      v1Client.listDeletedDashboards.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);

      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(result.items).toEqual(mockV1Response.items);
      expect(v1Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10, continue: undefined });
      expect(v2Client.listDeletedDashboards).not.toHaveBeenCalled();

      const decoded = JSON.parse(atob(result.metadata.continue!));
      expect(decoded).toEqual({ v1: 'v1-token' });
    });

    it('should combine responses when v1 returns mixed v1/v2 dashboards', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '123', continue: 'v1-next' },
        items: [
          {
            metadata: { name: 'v2-dash', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v2beta1', error: 'conversion failed' } },
          },
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v1beta1',
            metadata: { name: 'v1-dash', resourceVersion: '123', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: { title: 'v1', schemaVersion: 30 },
            status: {},
          },
        ],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '456', continue: 'v2-next' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: { name: 'v2-dash', resourceVersion: '456', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
          {
            metadata: { name: 'v1-dash', resourceVersion: '456', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: { title: 'v1', elements: null },
            status: { conversion: { failed: true, storedVersion: 'v1beta1', error: 'conversion failed' } },
          },
        ],
      };

      v1Client.listDeletedDashboards.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDeletedDashboards.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual([mockV1Response.items[1], mockV2Response.items[0]]);
      expect(v1Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10, continue: undefined });
      expect(v2Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10, continue: undefined });

      const continueToken = result.metadata.continue!;
      const decoded = JSON.parse(atob(continueToken));
      expect(decoded).toEqual({ v1: 'v1-next', v2: 'v2-next' });
    });

    it('should return v2 deleted dashboards for pure v2 (no v1 items)', async () => {
      const mockV1Response = {
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '1', continue: 'v1-token' },
        items: [],
      };
      const mockV2Response = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'DashboardList',
        metadata: { resourceVersion: '2', continue: 'v2-token' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: { name: 'v2-dash', resourceVersion: '2', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
        ],
      };

      v1Client.listDeletedDashboards.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDeletedDashboards.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(v2Client.listDeletedDashboards).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);

      const decoded = JSON.parse(atob(result.metadata.continue!));
      expect(decoded).toEqual({ v1: 'v1-token', v2: 'v2-token' });
    });

    it('should decode composite continue token and pass separate tokens to v1/v2 clients', async () => {
      const compositeToken = btoa(JSON.stringify({ v1: 'v1-page2', v2: 'v2-page2' }));

      const mockV1Response = {
        metadata: { resourceVersion: '1' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v1beta1',
            metadata: { name: 'v1-dash', resourceVersion: '1', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: { title: 'v1', schemaVersion: 30 },
            status: {},
          },
          {
            metadata: { name: 'v2-dash', resourceVersion: '2', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: null,
            status: { conversion: { failed: true, storedVersion: 'v2beta1', error: 'conversion failed' } },
          },
        ],
      };
      const mockV2Response = {
        metadata: { resourceVersion: '2' },
        items: [
          {
            kind: 'Dashboard',
            apiVersion: 'dashboard.grafana.app/v2beta1',
            metadata: { name: 'v2-dash', resourceVersion: '2', creationTimestamp: '2023-01-01T00:00:00Z' },
            spec: { title: 'v2', elements: {} },
            status: {},
          },
        ],
      };

      v1Client.listDeletedDashboards.mockResolvedValue(mockV1Response as ResourceList<DashboardDataDTO>);
      v2Client.listDeletedDashboards.mockResolvedValue(mockV2Response as ResourceList<DashboardV2Spec>);

      await api.listDeletedDashboards({ limit: 10, continue: compositeToken });

      expect(v1Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10, continue: 'v1-page2' });
      expect(v2Client.listDeletedDashboards).toHaveBeenCalledWith({ limit: 10, continue: 'v2-page2' });
    });

    it('should throw error if v1 throws DashboardVersionError', async () => {
      const mockError = new DashboardVersionError('unsupported version');
      v1Client.listDeletedDashboards.mockRejectedValue(mockError);

      await expect(api.listDeletedDashboards({ limit: 10 })).rejects.toThrow(mockError);
      expect(v2Client.listDeletedDashboards).not.toHaveBeenCalled();
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

      await api.restoreDashboard(mockV1Dashboard);

      expect(v1Client.restoreDashboard).toHaveBeenCalledWith(mockV1Dashboard);
      expect(v2Client.restoreDashboard).not.toHaveBeenCalled();
    });

    it('should use v2 client for v2 dashboard resource', async () => {
      const mockV2Dashboard = {
        apiVersion: 'dashboard.grafana.app/v2beta1',
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

      await api.restoreDashboard(mockV2Dashboard);

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
