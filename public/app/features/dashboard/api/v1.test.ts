import { GrafanaConfig, locationUtil } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { AnnoKeyFolder, AnnoReloadOnParamsChange } from 'app/features/apiserver/types';
import { DashboardDataDTO } from 'app/types/dashboard';

import { DashboardWithAccessInfo } from './types';
import { K8sDashboardAPI } from './v1';

const mockDashboardDto: DashboardWithAccessInfo<DashboardDataDTO> = {
  kind: 'DashboardWithAccessInfo',
  apiVersion: 'v1beta1',

  metadata: {
    name: 'dash-uid',
    resourceVersion: '1',
    creationTimestamp: '1',
    annotations: {},
    generation: 1,
  },
  spec: {
    title: 'test',
    // V1 API doesn't return the uid or version in the spec
    // setting it as empty string here because it's required in DashboardDataDTO
    uid: '',
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
const mockPost = jest.fn().mockResolvedValue(saveDashboardResponse);
const mockPut = jest.fn().mockResolvedValue(saveDashboardResponse);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: mockGet,
    put: mockPut,
    post: mockPost,
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(result.meta.slug).toBe('test');
    expect(result.meta.isFolder).toBe(false);
    expect(result.meta.folderId).toBe(1);
    expect(result.meta.folderTitle).toBe('New Folder');
    expect(result.meta.folderUrl).toBe('/folder/url');
    expect(result.meta.folderUid).toBe('new-folder');
  });

  it('should correctly set uid and version in the spec', async () => {
    const api = new K8sDashboardAPI();
    // we are fetching the mockDashboardDTO, which doesn't have a uid or version
    // and this is expected because V1 API doesn't return the uid or version in the spec
    // however, we need these fields to be set in the dashboard object to avoid creating duplicates when editing an existing dashboard
    // getDashboardDTO should set the uid and version from the metadata.name (uid) and metadata.generation (version)
    const result = await api.getDashboardDTO('dash-uid');
    expect(result.dashboard.uid).toBe('dash-uid');
    expect(result.dashboard.version).toBe(1);
  });

  it('throws an error if folder service returns an error other than 403', async () => {
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

  it('should not throw an error if folder is not found and user has access to dashboard but not to folder', async () => {
    mockGet.mockResolvedValueOnce({
      ...mockDashboardDto,
      metadata: { ...mockDashboardDto.metadata, annotations: { [AnnoKeyFolder]: 'new-folder' } },
    });
    jest.spyOn(backendSrv, 'getFolderByUid').mockRejectedValueOnce({ message: 'folder not found', status: 403 });

    const api = new K8sDashboardAPI();
    const dashboardDTO = await api.getDashboardDTO('test');
    expect(dashboardDTO.dashboard).toMatchObject({
      schemaVersion: 0,
      title: 'test',
      uid: 'dash-uid',
      version: 1,
    });
    // we still want to save the folder uid so that we can properly handle disabling the folder picker in Settings -> General
    expect(dashboardDTO.meta.folderUid).toBe('new-folder');
    expect(dashboardDTO.meta.folderTitle).toBeUndefined();
    expect(dashboardDTO.meta.folderUrl).toBeUndefined();
    expect(dashboardDTO.meta.folderId).toBeUndefined();
  });

  it('should set reloadOnParamsChange to true if AnnoReloadOnParamsChange is present', async () => {
    mockGet.mockResolvedValueOnce({
      ...mockDashboardDto,
      metadata: { ...mockDashboardDto.metadata, annotations: { [AnnoReloadOnParamsChange]: true } },
    });

    const api = new K8sDashboardAPI();
    const result = await api.getDashboardDTO('test');
    expect(result.meta.reloadOnParamsChange).toBe(true);
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
        expect(result.slug).toBe('new-dashboard-saved');
        expect(result.version).toBe(1);
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

        expect(result.slug).toBe('new-dashboard-saved');
        expect(result.uid).toBe('adh59cn');
        expect(result.version).toBe(1);
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
        expect(result.slug).toBe('new-dashboard-saved');
        expect(result.version).toBe(1);
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
        expect(result.slug).toBe('new-dashboard-saved');
        expect(result.version).toBe(1);
        expect(result.url).toBe('/grafana/d/adh59cn/new-dashboard-saved');
      });
    });
  });

  describe('version error handling', () => {
    it('should throw DashboardVersionError for v2beta1 conversion error', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        status: {
          conversion: {
            failed: true,
            error: 'backend conversion not yet implemented',
            storedVersion: 'v2beta1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardAPI();
      await expect(api.getDashboardDTO('test')).rejects.toThrow('backend conversion not yet implemented');
    });

    it.each(['v0alpha1', 'v1beta1'])('should not throw for %s conversion errors', async (correctStoredVersion) => {
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

  describe('listDeletedDashboards', () => {
    it('should return list of deleted dashboards', async () => {
      const mockDeletedDashboards = {
        items: [
          {
            ...mockDashboardDto,
            metadata: { ...mockDashboardDto.metadata, name: 'deleted-dash-1' },
          },
          {
            ...mockDashboardDto,
            metadata: { ...mockDashboardDto.metadata, name: 'deleted-dash-2' },
          },
        ],
      };

      mockGet.mockResolvedValueOnce(mockDeletedDashboards);

      const api = new K8sDashboardAPI();
      const result = await api.listDeletedDashboards({ limit: 10 });

      expect(result).toEqual(mockDeletedDashboards);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('restoreDashboard', () => {
    it('should reset resource version and return created dashboard', async () => {
      const dashboardToRestore = {
        ...mockDashboardDto,
        metadata: {
          ...mockDashboardDto.metadata,
          resourceVersion: '123456',
        },
      };

      const api = new K8sDashboardAPI();
      const result = await api.restoreDashboard(dashboardToRestore);

      expect(dashboardToRestore.metadata.resourceVersion).toBe('');
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/apis/dashboard.grafana.app/v1beta1/'),
        expect.objectContaining({
          metadata: expect.objectContaining({
            resourceVersion: '',
          }),
        }),
        expect.anything()
      );
      expect(result).toEqual(saveDashboardResponse);
    });

    it('should handle dashboard with empty resource version', async () => {
      const dashboardToRestore = {
        ...mockDashboardDto,
        metadata: {
          ...mockDashboardDto.metadata,
          resourceVersion: '',
        },
      };

      const api = new K8sDashboardAPI();
      await api.restoreDashboard(dashboardToRestore);

      expect(dashboardToRestore.metadata.resourceVersion).toBe('');
      expect(mockPost).toHaveBeenCalled();
    });
  });
});
