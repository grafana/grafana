import {
  Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  AnnoKeyFolder,
  AnnoKeyFolderTitle,
  AnnoKeyFolderUrl,
  AnnoKeyMessage,
  AnnoKeySavedFromUI,
  DeprecatedInternalId,
} from 'app/features/apiserver/types';

import { DashboardWithAccessInfo } from './types';
import { K8sDashboardV2API } from './v2';

const mockDashboardDto: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  apiVersion: 'v0alpha1',

  metadata: {
    name: 'dash-uid',
    generation: 1,
    resourceVersion: '1',
    creationTimestamp: '1',
    annotations: {},
  },
  spec: {
    ...defaultDashboardV2Spec(),
  },
  access: {},
};

// Create mock get, put, and post functions that we can spy on
const mockGet = jest.fn().mockResolvedValue(mockDashboardDto);

const mockPut = jest.fn().mockImplementation((url, data) => {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Dashboard',
    metadata: {
      name: data.metadata?.name,
      generation: 2,
      resourceVersion: '2',
      creationTimestamp: new Date().toISOString(),
      labels: data.metadata?.labels,
      annotations: data.metadata?.annotations,
    },
    spec: data.spec,
  };
});

const mockPost = jest.fn().mockImplementation((url, data) => {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Dashboard',
    metadata: {
      name: data.metadata?.name || 'restored-dash',
      generation: 1,
      resourceVersion: '1',
      creationTimestamp: new Date().toISOString(),
      labels: data.metadata?.labels,
      annotations: data.metadata?.annotations,
    },
    spec: data.spec,
  };
});

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
      ...jest.requireActual('@grafana/runtime').config.buildInfo,
      versionString: '10.0.0',
    },
  },
}));

jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

describe('v2 dashboard API', () => {
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

    jest.spyOn(backendSrv, 'getFolderByUid').mockResolvedValue({
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

    const api = new K8sDashboardV2API();
    // because the API can currently return both DashboardDTO and DashboardWithAccessInfo<DashboardV2Spec> based on the
    // parameter convertToV1, we need to cast the result to DashboardWithAccessInfo<DashboardV2Spec> to be able to
    // access
    const result = (await api.getDashboardDTO('test')) as DashboardWithAccessInfo<DashboardV2Spec>;
    expect(result.metadata.annotations![AnnoKeyFolderTitle]).toBe('New Folder');
    expect(result.metadata.annotations![AnnoKeyFolderUrl]).toBe('/folder/url');
    expect(result.metadata.annotations![AnnoKeyFolder]).toBe('new-folder');
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

    const api = new K8sDashboardV2API();
    await expect(api.getDashboardDTO('test')).rejects.toThrow('Failed to load folder');
  });

  it('should not throw an error if folder is not found and user has access to dashboard but not to folder', async () => {
    mockGet.mockResolvedValueOnce({
      ...mockDashboardDto,
      metadata: { ...mockDashboardDto.metadata, annotations: { [AnnoKeyFolder]: 'new-folder' } },
    });
    jest.spyOn(backendSrv, 'getFolderByUid').mockRejectedValueOnce({ message: 'folder not found', status: 403 });

    const api = new K8sDashboardV2API();
    const dashboardDTO = await api.getDashboardDTO('test');
    expect(dashboardDTO.spec).toMatchObject({
      title: '',
    });
  });
  describe('v2 dashboard API - Save', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const defaultSaveCommand = {
      dashboard: defaultDashboardV2Spec(),
      message: 'test save',
      folderUid: 'test-folder',
      k8s: {
        name: 'test-dash',
        labels: {
          [DeprecatedInternalId]: '123',
        },

        annotations: {
          [AnnoKeyFolder]: 'new-folder',
          [AnnoKeyMessage]: 'test save',
        },
      },
    };

    it('should create new dashboard', async () => {
      const api = new K8sDashboardV2API();
      const result = await api.saveDashboard({
        ...defaultSaveCommand,
        dashboard: {
          ...defaultSaveCommand.dashboard,
          title: 'test-dashboard',
        },
      });

      expect(result).toEqual({
        id: 123,
        uid: 'test-dash',
        url: '/d/test-dash/testdashboard',
        slug: 'testdashboard',
        status: 'success',
        version: 2,
      });
    });

    it('should update existing dashboard', async () => {
      const api = new K8sDashboardV2API();

      const result = await api.saveDashboard({
        ...defaultSaveCommand,
        dashboard: {
          ...defaultSaveCommand.dashboard,
          title: 'chaing-title-dashboard',
        },
        k8s: {
          ...defaultSaveCommand.k8s,
          name: 'existing-dash',
        },
      });
      expect(result.slug).toBe('chaingtitledashboard');
      expect(result.version).toBe(2);
    });

    it('should update existing dashboard that is store in a folder', async () => {
      const api = new K8sDashboardV2API();
      await api.saveDashboard({
        dashboard: {
          ...defaultSaveCommand.dashboard,
          title: 'chaing-title-dashboard',
        },
        folderUid: 'folderUidXyz',
        k8s: {
          name: 'existing-dash',
          annotations: {
            [AnnoKeyFolder]: 'folderUidXyz',
            [AnnoKeyFolderUrl]: 'url folder used in the client',
            [AnnoKeyFolderTitle]: 'title folder used in the client',
          },
        },
      });
      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut).toHaveBeenCalledWith(
        '/apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboards/existing-dash',
        {
          metadata: {
            name: 'existing-dash',
            annotations: {
              [AnnoKeyFolder]: 'folderUidXyz',
              [AnnoKeySavedFromUI]: '10.0.0',
            },
          },
          spec: {
            ...defaultSaveCommand.dashboard,
            title: 'chaing-title-dashboard',
          },
        },
        { params: undefined }
      );
    });
  });

  describe('version error handling', () => {
    it('should not throw DashboardVersionError for v0alpha1 conversion error and v2 spec', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        status: {
          conversion: {
            failed: true,
            error: 'backend conversion not yet implemented',
            storedVersion: 'v0alpha1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardV2API();
      await expect(api.getDashboardDTO('test')).resolves.toBe(mockDashboardWithError);
    });

    it('should throw DashboardVersionError for v0alpha1 conversion error and v1 spec', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        spec: {
          // this is a v1 dashboard
          title: 'test-dashboard',
          panels: [],
        },
        status: {
          conversion: {
            failed: true,
            error: 'backend conversion not yet implemented',
            storedVersion: 'v0alpha1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardV2API();
      await expect(api.getDashboardDTO('test')).rejects.toThrow('backend conversion not yet implemented');
    });

    it('should not throw DashboardVersionError for v1beta1 conversion error and v2 spec', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        status: {
          conversion: {
            failed: true,
            error: 'backend conversion not yet implemented',
            storedVersion: 'v1beta1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardV2API();
      await expect(api.getDashboardDTO('test')).resolves.toBe(mockDashboardWithError);
    });

    it('should throw DashboardVersionError for v1beta1 conversion error and v1 spec', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        spec: {
          // this is a v1 dashboard
          title: 'test-dashboard',
          panels: [],
        },
        status: {
          conversion: {
            failed: true,
            error: 'backend conversion not yet implemented',
            storedVersion: 'v1beta1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardV2API();
      await expect(api.getDashboardDTO('test')).rejects.toThrow('backend conversion not yet implemented');
    });

    it('should not throw for other conversion errors', async () => {
      const mockDashboardWithError = {
        ...mockDashboardDto,
        status: {
          conversion: {
            failed: true,
            error: 'other-error',
            storedVersion: 'v2beta1',
          },
        },
      };

      mockGet.mockResolvedValueOnce(mockDashboardWithError);

      const api = new K8sDashboardV2API();
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

      const api = new K8sDashboardV2API();
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

      const api = new K8sDashboardV2API();
      const result = await api.restoreDashboard(dashboardToRestore);

      expect(dashboardToRestore.metadata.resourceVersion).toBe('');
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/apis/dashboard.grafana.app/v2beta1/'),
        expect.objectContaining({
          metadata: expect.objectContaining({
            resourceVersion: '',
          }),
        }),
        expect.anything()
      );
      expect(result.metadata.name).toBe('dash-uid');
    });

    it('should handle dashboard with empty resource version', async () => {
      const dashboardToRestore = {
        ...mockDashboardDto,
        metadata: {
          ...mockDashboardDto.metadata,
          resourceVersion: '',
        },
      };

      const api = new K8sDashboardV2API();
      await api.restoreDashboard(dashboardToRestore);

      expect(dashboardToRestore.metadata.resourceVersion).toBe('');
      expect(mockPost).toHaveBeenCalled();
    });
  });
});
