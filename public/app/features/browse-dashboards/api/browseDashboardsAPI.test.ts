import { configureStore } from '@reduxjs/toolkit';
import { of, throwError } from 'rxjs';

import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isProvisionedFolderCheck } from 'app/api/clients/folder/v1beta1/utils';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { type FolderDTO } from 'app/types/folders';

import { browseDashboardsAPI } from './browseDashboardsAPI';

const mockGet = jest.fn().mockResolvedValue({});
const mockFetch = jest.fn();
const mockPut = jest.fn().mockResolvedValue({});
const mockPost = jest.fn().mockResolvedValue({});

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

jest.mock('app/api/clients/folder/v1beta1/utils', () => ({
  ...jest.requireActual('app/api/clients/folder/v1beta1/utils'),
  isProvisionedFolderCheck: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: mockFetch,
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

describe('browseDashboardsAPI', () => {
  const getDashboardAPIMock = jest.mocked(getDashboardAPI);
  const isProvisionedFolderCheckMock = jest.mocked(isProvisionedFolderCheck);
  const createTestStore = () =>
    configureStore({
      reducer: {
        [browseDashboardsAPI.reducerPath]: browseDashboardsAPI.reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(browseDashboardsAPI.middleware),
    });

  beforeEach(() => {
    getDashboardAPIMock.mockReset();
    mockFetch.mockReset();
    isProvisionedFolderCheckMock.mockResolvedValue(false);
  });

  const createMockDashboardAPI = (saveDashboard: jest.Mock) =>
    ({ saveDashboard }) as unknown as ReturnType<typeof getDashboardAPI>;

  it('uses v1 dashboard API for v1 dashboards', async () => {
    const saveDashboardV1 = jest.fn().mockResolvedValue({ uid: 'test-uid-v1' });
    const saveDashboardV2 = jest.fn().mockResolvedValue({ uid: 'test-uid-v2' });

    getDashboardAPIMock.mockImplementation((version?: 'v1' | 'v2') => {
      if (version === 'v1') {
        return createMockDashboardAPI(saveDashboardV1);
      }
      if (version === 'v2') {
        return createMockDashboardAPI(saveDashboardV2);
      }
      return createMockDashboardAPI(jest.fn());
    });

    const cmd: SaveDashboardCommand<Dashboard> = {
      dashboard: { title: 'V1', panels: [], schemaVersion: 1 } as unknown as Dashboard,
      folderUid: 'folder-1',
    };

    const store = createTestStore();
    await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

    expect(getDashboardAPIMock).toHaveBeenCalledWith('v1');
    expect(saveDashboardV1).toHaveBeenCalledWith(cmd);
    expect(saveDashboardV2).not.toHaveBeenCalled();
  });

  it('uses v2 dashboard API for v2 dashboards', async () => {
    const saveDashboardV1 = jest.fn().mockResolvedValue({ uid: 'test-uid-v1' });
    const saveDashboardV2 = jest.fn().mockResolvedValue({ uid: 'test-uid-v2' });

    getDashboardAPIMock.mockImplementation((version?: 'v1' | 'v2') => {
      if (version === 'v1') {
        return createMockDashboardAPI(saveDashboardV1);
      }
      if (version === 'v2') {
        return createMockDashboardAPI(saveDashboardV2);
      }
      return createMockDashboardAPI(jest.fn());
    });

    const v2Dashboard: DashboardV2Spec = { title: 'V2', elements: [] } as unknown as DashboardV2Spec;
    const cmd: SaveDashboardCommand<DashboardV2Spec> = {
      dashboard: v2Dashboard,
      folderUid: 'folder-2',
    };

    const store = createTestStore();
    await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

    expect(getDashboardAPIMock).toHaveBeenCalledWith('v2');
    expect(saveDashboardV2).toHaveBeenCalledWith(cmd);
    expect(saveDashboardV1).not.toHaveBeenCalled();
  });

  it('evicts a cached getFolder entry after deleting that folder', async () => {
    const store = createTestStore();
    const folderQueryArg = { folderUID: 'folder-1', accesscontrol: true, isLegacyCall: false };

    await store.dispatch(
      browseDashboardsAPI.util.upsertQueryData('getFolder', folderQueryArg, { uid: 'folder-1' } as FolderDTO)
    );
    expect(browseDashboardsAPI.endpoints.getFolder.select(folderQueryArg)(store.getState()).status).toBe('fulfilled');

    mockFetch.mockReturnValueOnce(of({ data: {} }));

    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    expect(browseDashboardsAPI.endpoints.getFolder.select(folderQueryArg)(store.getState()).status).toBe(
      'uninitialized'
    );
  });

  it('evicts only successfully deleted folders from the cache during bulk delete', async () => {
    const store = createTestStore();
    const folderOneQueryArg = { folderUID: 'folder-1', accesscontrol: true, isLegacyCall: false };
    const folderTwoQueryArg = { folderUID: 'folder-2', accesscontrol: true, isLegacyCall: false };

    await store.dispatch(
      browseDashboardsAPI.util.upsertQueryData('getFolder', folderOneQueryArg, { uid: 'folder-1' } as FolderDTO)
    );
    await store.dispatch(
      browseDashboardsAPI.util.upsertQueryData('getFolder', folderTwoQueryArg, { uid: 'folder-2' } as FolderDTO)
    );

    mockFetch.mockReturnValueOnce(of({ data: {} }));
    mockFetch.mockReturnValueOnce(throwError(() => ({ status: 404, data: { message: 'Folder not found' } })));

    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
    );

    expect(browseDashboardsAPI.endpoints.getFolder.select(folderOneQueryArg)(store.getState()).status).toBe(
      'uninitialized'
    );
    expect(browseDashboardsAPI.endpoints.getFolder.select(folderTwoQueryArg)(store.getState()).status).toBe(
      'fulfilled'
    );
  });
});
