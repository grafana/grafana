import { GrafanaConfig, locationUtil } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { DashboardDataDTO } from 'app/types';

import { DashboardWithAccessInfo } from './types';
import { K8sDashboardAPI } from './v1';

const mockDashboardDto: DashboardWithAccessInfo<DashboardDataDTO> = {
  kind: 'DashboardWithAccessInfo',
  apiVersion: 'v1alpha1',

  metadata: {
    name: 'dash-uid',
    resourceVersion: '1',
    creationTimestamp: '1',
    annotations: {},
  },
  spec: {
    title: 'test',
    uid: 'test',
    schemaVersion: 0,
  },
  access: {},
};

const saveDashboardResponse = {
  kind: 'Dashboard',
  apiVersion: 'dashboard.grafana.app/v1alpha1',
  metadata: {
    name: 'adh59cn',
    namespace: 'default',
    uid: '7970c819-9fa9-469e-8f8b-ba540110d81e',
    resourceVersion: '26830000001',
    generation: 1,
    creationTimestamp: '2025-01-08T15:45:54Z',
    labels: {
      'grafana.app/deprecatedInternalID': '2683',
    },
    annotations: {
      'grafana.app/createdBy': 'user:u000000001',
      'grafana.app/saved-from-ui': 'Grafana v11.5.0-pre (79cd8ac894)',
    },
  },
  spec: {
    annotations: {
      list: [
        {
          builtIn: 1,
          datasource: {
            type: 'grafana',
            uid: '-- Grafana --',
          },
          enable: true,
          hide: true,
          iconColor: 'rgba(0, 211, 255, 1)',
          name: 'Annotations \u0026 Alerts',
          type: 'dashboard',
        },
      ],
    },
    description: '',
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    id: null,
    links: [],
    panels: [],
    preload: false,
    refresh: '',
    schemaVersion: 40,
    tags: [],
    templating: {
      list: [],
    },
    time: {
      from: 'now-6h',
      to: 'now',
    },
    timepicker: {},
    timezone: 'browser',
    title: 'New dashboard saved',
    uid: '',
    version: 0,
    weekStart: '',
  },
};

const mockGet = jest.fn().mockResolvedValue(mockDashboardDto);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: mockGet,
    put: jest.fn().mockResolvedValue(saveDashboardResponse),
    post: jest.fn().mockResolvedValue(saveDashboardResponse),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      version: '11.5.0-test-version-string',
    },
  },
}));

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

describe('v1 dashboard API', () => {
  it('should provide folder annotations', async () => {
    mockGet.mockResolvedValueOnce({
      ...mockDashboardDto,
      metadata: {
        ...mockDashboardDto.metadata,
        annotations: { [AnnoKeyFolder]: 'new-folder' },
      },
    });

    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValueOnce({
      id: 1,
      uid: 'new-folder',
      title: 'New Folder',
      url: '/folder/url',
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      created: '',
      createdBy: '',
      hasAcl: false,
      updated: '',
      updatedBy: '',
    });

    const api = new K8sDashboardAPI();
    const result = await api.getDashboardDTO('test');
    expect(result.meta.isFolder).toBe(false);
    expect(result.meta.folderId).toBe(1);
    expect(result.meta.folderTitle).toBe('New Folder');
    expect(result.meta.folderUrl).toBe('/folder/url');
    expect(result.meta.folderUid).toBe('new-folder');
  });

  it('throws an error if folder is not found', async () => {
    mockGet.mockResolvedValueOnce({
      ...mockDashboardDto,
      metadata: {
        ...mockDashboardDto.metadata,
        annotations: { [AnnoKeyFolder]: 'new-folder' },
      },
    });
    jest
      .spyOn(backendSrv, 'getFolderByUid')
      .mockRejectedValueOnce({ message: 'folder not found', status: 'not-found' });

    const api = new K8sDashboardAPI();
    await expect(api.getDashboardDTO('test')).rejects.toThrow('Failed to load folder');
  });

  describe('saveDashboard', () => {
    beforeEach(() => {
      locationUtil.initialize({
        config: {
          appSubUrl: '',
        } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
    });

    describe('saving a existing dashboard', () => {
      it('should provide dashboard URL', async () => {
        const api = new K8sDashboardAPI();
        const result = await api.saveDashboard({
          dashboard: {
            title: 'Existing dashboard',
            uid: 'adh59cn',
            schemaVersion: 0,
          },
          message: 'test',
          overwrite: false,
          folderUid: 'test',
        });

        expect(result.uid).toBe('adh59cn');
        expect(result.version).toBe(0);
        expect(result.url).toBe('/d/adh59cn/new-dashboard-saved');
      });
      it('should provide dashboard URL with app sub url configured', async () => {
        const api = new K8sDashboardAPI();

        locationUtil.initialize({
          config: {
            appSubUrl: '/grafana',
          } as GrafanaConfig,
          getTimeRangeForUrl: jest.fn(),
          getVariablesUrlParams: jest.fn(),
        });

        const result = await api.saveDashboard({
          dashboard: {
            title: 'Existing dashboard',
            uid: 'adh59cn',
            schemaVersion: 0,
          },
          message: 'test',
          overwrite: false,
          folderUid: 'test',
        });

        expect(result.uid).toBe('adh59cn');
        expect(result.version).toBe(0);
        expect(result.url).toBe('/grafana/d/adh59cn/new-dashboard-saved');
      });
    });
    describe('saving a new dashboard', () => {
      it('should provide dashboard URL', async () => {
        const api = new K8sDashboardAPI();
        const result = await api.saveDashboard({
          dashboard: {
            title: 'Existing dashboard',
            schemaVersion: 0,
          },
          message: 'test',
          overwrite: false,
          folderUid: 'test',
        });

        expect(result.uid).toBe('adh59cn');
        expect(result.version).toBe(0);
        expect(result.url).toBe('/d/adh59cn/new-dashboard-saved');
      });

      it('should provide dashboard URL with app sub url configured', async () => {
        const api = new K8sDashboardAPI();

        locationUtil.initialize({
          config: {
            appSubUrl: '/grafana',
          } as GrafanaConfig,
          getTimeRangeForUrl: jest.fn(),
          getVariablesUrlParams: jest.fn(),
        });

        const result = await api.saveDashboard({
          dashboard: {
            title: 'Existing dashboard',
            schemaVersion: 0,
          },
          message: 'test',
          overwrite: false,
          folderUid: 'test',
        });

        expect(result.uid).toBe('adh59cn');
        expect(result.version).toBe(0);
        expect(result.url).toBe('/grafana/d/adh59cn/new-dashboard-saved');
      });
    });
  });

  describe('version error handling', () => {
    it('should throw DashboardVersionError for v2alpha1 conversion error', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        status: {
          conversion: {
            failed: true,
            error: 'backend conversion not yet implemented',
            storedVersion: 'v2alpha1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardAPI();
      await expect(api.getDashboardDTO('test')).rejects.toThrow('backend conversion not yet implemented');
    });

    it.each(['v0alpha1', 'v1alpha1'])('should not throw for %s conversion errors', async (correctStoredVersion) => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        status: {
          conversion: {
            failed: true,
            error: 'other-error',
            storedVersion: correctStoredVersion,
          },
        },
      };

      jest.spyOn(backendSrv, 'get').mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardAPI();
      await expect(api.getDashboardDTO('test')).resolves.toBeDefined();
    });
  });
});
