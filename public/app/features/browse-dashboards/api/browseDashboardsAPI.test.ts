import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { config, setBackendSrv } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { backendSrv } from 'app/core/services/backend_srv';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { deletedFoldersState } from 'app/features/search/service/deletedDashboardsCache';
import { setStore } from 'app/store/store';
import { type FolderDTO } from 'app/types/folders';

import { browseDashboardsAPI } from './browseDashboardsAPI';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
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
    folderAPIVersionResolver.set('v1beta1');
    config.featureToggles.provisioning = false;
    deletedFoldersState.clear();
    server.use(http.get('/api/access-control/user/actions', () => HttpResponse.json({})));
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

    const getFolderSpy = jest.fn();
    const deleteFolderSpy = jest.fn();

    server.use(
      http.get('/api/folders/folder-1', () => {
        getFolderSpy();
        return HttpResponse.json({ uid: 'folder-1' });
      }),
      http.delete('/api/folders/folder-1', () => {
        deleteFolderSpy();
        return HttpResponse.json({});
      })
    );

    const subscription = store.dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(folderQueryArg));
    await subscription;
    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    expect(getFolderSpy).toHaveBeenCalledTimes(1);
    expect(deleteFolderSpy).toHaveBeenCalledTimes(1);
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);

    subscription.unsubscribe();
  });

  it('does not check whether a single delete target is provisioned before deleting it', async () => {
    const store = createTestStore();
    config.featureToggles.provisioning = true;

    const getProvisionedFolderSpy = jest.fn();
    const deleteFolderSpy = jest.fn();

    server.use(
      http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/folder-1', () => {
        getProvisionedFolderSpy();
        return HttpResponse.json({
          apiVersion: 'folder.grafana.app/v1beta1',
          kind: 'Folder',
          metadata: {
            name: 'folder-1',
            namespace: 'default',
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
            },
          },
          spec: { title: 'Folder 1' },
        });
      }),
      http.delete('/api/folders/folder-1', () => {
        deleteFolderSpy();
        return HttpResponse.json({});
      })
    );

    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    expect(getProvisionedFolderSpy).not.toHaveBeenCalled();
    expect(deleteFolderSpy).toHaveBeenCalledTimes(1);
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);
  });

  it('marks only successfully deleted folders during bulk delete and does not refetch active folder queries', async () => {
    const store = createTestStore();
    const folderOneQueryArg = { folderUID: 'folder-1', accesscontrol: true, isLegacyCall: false };
    const folderTwoQueryArg = { folderUID: 'folder-2', accesscontrol: true, isLegacyCall: false };

    server.use(
      http.get('/api/folders/folder-1', () => HttpResponse.json({ uid: 'folder-1' })),
      http.get('/api/folders/folder-2', () => HttpResponse.json({ uid: 'folder-2' })),
      http.delete('/api/folders/folder-1', () => HttpResponse.json({})),
      http.delete('/api/folders/folder-2', () => HttpResponse.json({ message: 'Folder not found' }, { status: 404 }))
    );

    const firstSubscription = store.dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(folderOneQueryArg));
    const secondSubscription = store.dispatch(browseDashboardsAPI.endpoints.getFolder.initiate(folderTwoQueryArg));
    await Promise.all([firstSubscription, secondSubscription]);
    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
    );

    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);
    expect(deletedFoldersState.isDeleted('folder-2')).toBe(false);

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  });

  it('does not mark skipped provisioned folders as deleted', async () => {
    const store = createTestStore();
    config.featureToggles.provisioning = true;

    const deleteSpy = jest.fn();

    server.use(
      http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/folder-1', () =>
        HttpResponse.json({
          apiVersion: 'folder.grafana.app/v1beta1',
          kind: 'Folder',
          metadata: {
            name: 'folder-1',
            namespace: 'default',
            annotations: {
              [AnnoKeyManagerKind]: ManagerKind.Repo,
            },
          },
          spec: { title: 'Folder 1' },
        })
      ),
      http.delete('/api/folders/:uid', () => {
        deleteSpy();
        return HttpResponse.json({});
      })
    );

    await store.dispatch(browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1'] }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(deletedFoldersState.isDeleted('folder-1')).toBe(false);
  });

  it('does not mark folders as deleted when single delete fails', async () => {
    const store = createTestStore();

    server.use(http.delete('/api/folders/:uid', () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    expect(deletedFoldersState.isDeleted('folder-1')).toBe(false);
  });
});
