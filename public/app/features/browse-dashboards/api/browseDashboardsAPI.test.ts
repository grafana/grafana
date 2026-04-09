import { configureStore } from '@reduxjs/toolkit';
import { type Store } from 'redux';
import { of, throwError } from 'rxjs';

import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { deletedFoldersState } from 'app/features/search/service/deletedDashboardsCache';
import { setStore } from 'app/store/store';
import { type FolderDTO, type FolderListItemDTO } from 'app/types/folders';

import { browseDashboardsAPI } from './browseDashboardsAPI';

const mockGet = jest.fn().mockResolvedValue({});
const mockFetch = jest.fn();
const mockPut = jest.fn().mockResolvedValue({});
const mockPost = jest.fn().mockResolvedValue({});

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
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
  const createTestStore = () => {
    const store = configureStore({
      reducer: {
        [browseDashboardsAPI.reducerPath]: browseDashboardsAPI.reducer,
        [folderAPIv1beta1.reducerPath]: folderAPIv1beta1.reducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(browseDashboardsAPI.middleware, folderAPIv1beta1.middleware),
    });
    setStore(store as unknown as Store);
    return store;
  };

  beforeEach(() => {
    getDashboardAPIMock.mockReset();
    mockFetch.mockReset();
    mockGet.mockResolvedValue({
      versions: [{ version: 'v1beta1', groupVersion: 'folder.grafana.app/v1beta1' }],
      preferredVersion: { version: 'v1beta1', groupVersion: 'folder.grafana.app/v1beta1' },
    });
    const runtime = jest.requireMock('@grafana/runtime');
    runtime.config.featureToggles.provisioning = false;
    deletedFoldersState.clear();
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

  it('does not refetch an active getFolder subscription after deleting that folder', async () => {
    const store = createTestStore();
    const folderQueryArg = { folderUID: 'folder-1', accesscontrol: true, isLegacyCall: false };

    mockFetch.mockImplementation(({ method, url }) => {
      if (method === 'DELETE') {
        return of({ data: {} });
      }

      if (url === '/api/folders/folder-1') {
        return of({ data: { uid: 'folder-1' } });
      }

      if (url === '/api/folders') {
        return of({ data: [] as FolderListItemDTO[] });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const subscription = store.dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(folderQueryArg));
    await subscription;
    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    expect(mockFetch.mock.calls).toHaveLength(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ method: 'GET', url: '/api/folders/folder-1' })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: 'DELETE', url: '/api/folders/folder-1' })
    );
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);

    subscription.unsubscribe();
  });

  it('marks only successfully deleted folders during bulk delete and does not refetch active folder queries', async () => {
    const store = createTestStore();
    const folderOneQueryArg = { folderUID: 'folder-1', accesscontrol: true, isLegacyCall: false };
    const folderTwoQueryArg = { folderUID: 'folder-2', accesscontrol: true, isLegacyCall: false };

    mockFetch.mockImplementation(({ method, url }) => {
      if (method === 'DELETE' && url === '/api/folders/folder-1') {
        return of({ data: {} });
      }

      if (method === 'DELETE' && url === '/api/folders/folder-2') {
        return throwError(() => ({ status: 404, data: { message: 'Folder not found' } }));
      }

      if (url === '/api/folders/folder-1') {
        return of({ data: { uid: 'folder-1' } });
      }

      if (url === '/api/folders/folder-2') {
        return of({ data: { uid: 'folder-2' } });
      }

      if (url === '/api/folders') {
        return of({ data: [] as FolderListItemDTO[] });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const firstSubscription = store.dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(folderOneQueryArg));
    const secondSubscription = store.dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(folderTwoQueryArg));
    await Promise.all([firstSubscription, secondSubscription]);
    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
    );

    expect(mockFetch.mock.calls).toHaveLength(4);
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);
    expect(deletedFoldersState.isDeleted('folder-2')).toBe(false);

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  });

  it('does not mark skipped provisioned folders as deleted', async () => {
    const store = createTestStore();
    const runtime = jest.requireMock('@grafana/runtime');
    runtime.config.featureToggles.provisioning = true;

    mockFetch.mockImplementation(({ method, url }) => {
      if (method === 'GET' && url === '/apis/folder.grafana.app/v1beta1/namespaces/default/folders/folder-1') {
        return of({
          data: {
            metadata: {
              name: 'folder-1',
              annotations: {
                [AnnoKeyManagerKind]: ManagerKind.Repo,
              },
            },
          },
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await store.dispatch(browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1'] }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/apis/folder.grafana.app/v1beta1/namespaces/default/folders/folder-1',
      })
    );
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(false);
  });

  it('does not mark folders as deleted when single delete fails', async () => {
    const store = createTestStore();
    mockFetch.mockImplementation(() => throwError(() => ({ status: 500, data: { message: 'boom' } })));

    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    expect(deletedFoldersState.isDeleted('folder-1')).toBe(false);
  });
});
