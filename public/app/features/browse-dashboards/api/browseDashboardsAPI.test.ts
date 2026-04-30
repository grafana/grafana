import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';
import { testWithFeatureToggles } from 'test/test-utils';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import * as quotasAPI from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { config, setBackendSrv } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { customFolderCountsHandler } from '@grafana/test-utils/unstable';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { deletedDashboardsCache } from 'app/features/search/service/deletedDashboardsCache';
import { setStore } from 'app/store/store';
import { type FolderDTO } from 'app/types/folders';
import { type ThunkDispatch } from 'app/types/store';

import { refetchChildren } from '../state/actions';
import { browseDashboardsReducer } from '../state/slice';

import { browseDashboardsAPI } from './browseDashboardsAPI';
import { PAGE_SIZE } from './constants';

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
        browseDashboards: browseDashboardsReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(browseDashboardsAPI.middleware, folderAPIv1beta1.middleware),
    });
    setStore(store as unknown as Store);
    return store;
  };

  testWithFeatureToggles({ disable: ['provisioning'] });

  beforeEach(() => {
    getDashboardAPIMock.mockReset();
    folderAPIVersionResolver.set('v1beta1');
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
    const invalidateQuotaUsageSpy = jest.spyOn(quotasAPI, 'invalidateQuotaUsage');

    try {
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
      expect(invalidateQuotaUsageSpy).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
    } finally {
      invalidateQuotaUsageSpy.mockRestore();
    }
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
  });

  describe('getAffectedItems', () => {
    it('aggregates plural descendant count keys', async () => {
      const store = createTestStore();

      server.use(
        customFolderCountsHandler(({ params }) =>
          HttpResponse.json(
            params.uid === 'folder-1'
              ? {
                  folders: 2,
                  dashboards: 3,
                  library_elements: 4,
                  alertrules: 5,
                }
              : {
                  folders: 1,
                  dashboards: 2,
                  library_elements: 3,
                  alertrules: 4,
                }
          )
        )
      );

      const result = await store.dispatch(
        browseDashboardsAPI.endpoints.getAffectedItems.initiate({
          folderUIDs: ['folder-1', 'folder-2'],
          dashboardUIDs: ['dashboard-1'],
        })
      );

      expect(result.data).toEqual({
        folders: 5,
        dashboards: 6,
        library_elements: 7,
        alertrules: 9,
      });
    });

    it('falls back to legacy descendant count keys', async () => {
      const store = createTestStore();

      server.use(
        customFolderCountsHandler(() =>
          HttpResponse.json({
            folder: 2,
            dashboard: 3,
            librarypanel: 4,
            alertrule: 5,
          })
        )
      );

      const result = await store.dispatch(
        browseDashboardsAPI.endpoints.getAffectedItems.initiate({
          folderUIDs: ['folder-1'],
          dashboardUIDs: [],
        })
      );

      expect(result.data).toEqual({
        folders: 3,
        dashboards: 3,
        library_elements: 4,
        alertrules: 5,
      });
    });

    it('defaults missing descendant counts to zero', async () => {
      const store = createTestStore();

      server.use(customFolderCountsHandler(() => HttpResponse.json({ dashboards: 3 })));

      const result = await store.dispatch(
        browseDashboardsAPI.endpoints.getAffectedItems.initiate({
          folderUIDs: ['folder-1'],
          dashboardUIDs: ['dashboard-1', 'dashboard-2'],
        })
      );

      expect(result.data).toEqual({
        folders: 1,
        dashboards: 5,
        library_elements: 0,
        alertrules: 0,
      });
      expect(result.data && Object.values(result.data).every(Number.isFinite)).toBe(true);
    });
  });

  // RTK Query logs a console.error for void queryFn returning { data: undefined }.
  describe('deleteFolders', () => {
    let consoleErrorSpy: jest.SpyInstance;
    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('does not refetch active folder queries during bulk delete', async () => {
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

      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    });

    it('invalidates the folder list when bulk delete yields no successes', async () => {
      const store = createTestStore();
      const listFoldersSpy = jest.fn();
      const clearDeletedDashboardsCacheSpy = jest.spyOn(deletedDashboardsCache, 'clear');
      const invalidateQuotaUsageSpy = jest.spyOn(quotasAPI, 'invalidateQuotaUsage');

      try {
        server.use(
          http.get('/api/folders', () => {
            listFoldersSpy();
            return HttpResponse.json([{ uid: 'folder-1', title: 'Folder 1' }]);
          }),
          http.delete('/api/folders/folder-1', () =>
            HttpResponse.json({ message: 'Folder not found' }, { status: 404 })
          ),
          http.delete('/api/folders/folder-2', () =>
            HttpResponse.json({ message: 'Folder not found' }, { status: 404 })
          )
        );

        const subscription = store.dispatch(
          browseDashboardsAPI.endpoints.listFolders.initiate({ parentUid: undefined, limit: PAGE_SIZE, page: 1 })
        );

        await subscription;
        await store.dispatch(
          browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
        );

        expect(listFoldersSpy).toHaveBeenCalledTimes(2);
        expect(clearDeletedDashboardsCacheSpy).toHaveBeenCalledTimes(1);
        expect(invalidateQuotaUsageSpy).toHaveBeenCalledTimes(1);

        subscription.unsubscribe();
      } finally {
        clearDeletedDashboardsCacheSpy.mockRestore();
        invalidateQuotaUsageSpy.mockRestore();
      }
    });

    it('refreshes parents for requested folders even when bulk delete yields no successes', async () => {
      const store = createTestStore();
      const dispatch = store.dispatch as ThunkDispatch;
      const listFoldersSpy = jest.fn();
      const hasPermissionSpy = jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

      server.use(
        http.get('/api/folders', () => {
          listFoldersSpy();
          return HttpResponse.json(
            Array.from({ length: PAGE_SIZE }, (_, index) => ({
              uid: `folder-${index + 1}`,
              title: `Folder ${index + 1}`,
            }))
          );
        }),
        http.delete('/api/folders/folder-1', () => HttpResponse.json({ message: 'Folder not found' }, { status: 404 })),
        http.delete('/api/folders/folder-2', () => HttpResponse.json({ message: 'Folder not found' }, { status: 404 }))
      );

      try {
        await dispatch(refetchChildren({ parentUID: undefined, pageSize: PAGE_SIZE }));
        await store.dispatch(
          browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
        );

        expect(listFoldersSpy).toHaveBeenCalledTimes(2);
      } finally {
        hasPermissionSpy.mockRestore();
      }
    });

    it('does not delete provisioned folders during bulk delete', async () => {
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
    });
  });
});
