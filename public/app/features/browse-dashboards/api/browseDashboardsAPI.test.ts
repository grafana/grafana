import { type Middleware, type UnknownAction, isAnyOf } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';
import { waitFor } from 'test/test-utils';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import * as quotasAPI from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { config, setBackendSrv } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { collectionsAPIv1alpha1 } from 'app/api/clients/collections/v1alpha1';
import { backendSrv } from 'app/core/services/backend_srv';
import { AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { deletedDashboardsCache } from 'app/features/search/service/deletedDashboardsCache';
import { invalidateStarredSearch } from 'app/features/stars/api';
import { userStarsFieldSelector } from 'app/features/stars/utils';
import * as variablesManagementCache from 'app/features/variables-management/cache';
import { addExtraMiddleware, configureStore } from 'app/store/configureStore';
import { type FolderDTO } from 'app/types/folders';

import { refetchChildren } from '../state/actions';

import { browseDashboardsAPI } from './browseDashboardsAPI';
import { PAGE_SIZE } from './constants';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: jest.fn(),
}));

// The app's own store, so the slices and middleware the mutations reach come from the real wiring rather than a list
// kept in step by hand. Extra middleware is registered once for the module; each store gets its own recorder.
let recordAction: Middleware = () => (next) => (action) => next(action);
addExtraMiddleware((api) => (next) => (action) => recordAction(api)(next)(action));

describe('browseDashboardsAPI', () => {
  const getDashboardAPIMock = jest.mocked(getDashboardAPI);
  // `recorder` sees every dispatch on the returned store, so tests can assert on them
  const makeRecorderStore = (recorder: Middleware) => {
    recordAction = recorder;
    return configureStore();
  };

  const createTestStore = () => makeRecorderStore(() => (next) => (action) => next(action));

  // Records starred-search invalidations so tests can assert on starred row cleanup
  const createStoreWithStarredSearchRecorder = () => {
    const invalidations: UnknownAction[] = [];
    const recorder: Middleware = () => (next) => (action) => {
      if (collectionsAPIv1alpha1.util.invalidateTags.match(action)) {
        invalidations.push(action);
      }
      return next(action);
    };

    return { store: makeRecorderStore(recorder), invalidations };
  };

  let originalProvisioningEnabled: boolean;

  beforeEach(() => {
    originalProvisioningEnabled = config.provisioningEnabled;
    config.provisioningEnabled = false;
    getDashboardAPIMock.mockReset();
    folderAPIVersionResolver.set('v1beta1');
    server.use(http.get('/api/access-control/user/actions', () => HttpResponse.json({})));
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
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

  it('invalidates quota usage after deleting a folder', async () => {
    const store = createTestStore();
    const invalidateQuotaUsageSpy = jest.spyOn(quotasAPI, 'invalidateQuotaUsage');

    try {
      server.use(http.delete('/api/folders/folder-1', () => HttpResponse.json({})));

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
      );

      expect(invalidateQuotaUsageSpy).toHaveBeenCalledTimes(1);
    } finally {
      invalidateQuotaUsageSpy.mockRestore();
    }
  });

  it('does not check whether a single delete target is provisioned before deleting it', async () => {
    const store = createTestStore();
    config.provisioningEnabled = true;

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

  it('invalidates the starred search after deleting a folder', async () => {
    const { store, invalidations } = createStoreWithStarredSearchRecorder();

    server.use(http.delete('/api/folders/:uid', () => HttpResponse.json({})));

    await store.dispatch(
      browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
    );

    await waitFor(() => {
      expect(invalidations).toEqual([invalidateStarredSearch()]);
    });
  });

  it('invalidates the variables list after deleting a folder', async () => {
    const store = createTestStore();
    const invalidateVariablesSpy = jest.spyOn(variablesManagementCache, 'invalidateVariablesAfterFolderDelete');

    try {
      server.use(http.delete('/api/folders/folder-1', () => HttpResponse.json({})));

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
      );

      await waitFor(() => {
        expect(invalidateVariablesSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      invalidateVariablesSpy.mockRestore();
    }
  });

  it('invalidates the variables list even when deleting a folder fails', async () => {
    const store = createTestStore();
    const invalidateVariablesSpy = jest.spyOn(variablesManagementCache, 'invalidateVariablesAfterFolderDelete');

    try {
      server.use(
        http.delete('/api/folders/folder-1', () =>
          HttpResponse.json({ message: 'folder delete failed' }, { status: 500 })
        )
      );

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolder.initiate({ uid: 'folder-1', parentUid: undefined } as FolderDTO)
      );

      await waitFor(() => {
        expect(invalidateVariablesSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      invalidateVariablesSpy.mockRestore();
    }
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

    it('deletes each requested folder in order and refreshes the root and team folder trees', async () => {
      const deletedUids: string[] = [];
      const refetchParents: Array<string | undefined> = [];
      const recorder: Middleware = () => (next) => (action) => {
        if (isAnyOf(refetchChildren.pending)(action)) {
          refetchParents.push(action.meta.arg.parentUID);
        }
        return next(action);
      };
      const store = makeRecorderStore(recorder);

      server.use(
        http.delete('/api/folders/:uid', ({ params }) => {
          deletedUids.push(String(params.uid));
          return HttpResponse.json({});
        })
      );

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
      );

      expect(deletedUids).toEqual(['folder-1', 'folder-2']);
      // The deleted uids are unknown to the tree, so refreshParents falls back to the root.
      await waitFor(() => {
        expect(refetchParents).toEqual(expect.arrayContaining([undefined, TEAM_FOLDERS_UID]));
      });
    });

    it('clears caches and invalidates quota usage when bulk delete yields no successes', async () => {
      const store = createTestStore();
      const clearDeletedDashboardsCacheSpy = jest.spyOn(deletedDashboardsCache, 'clear');
      const invalidateQuotaUsageSpy = jest.spyOn(quotasAPI, 'invalidateQuotaUsage');

      try {
        server.use(
          http.delete('/api/folders/folder-1', () =>
            HttpResponse.json({ message: 'Folder not found' }, { status: 404 })
          ),
          http.delete('/api/folders/folder-2', () =>
            HttpResponse.json({ message: 'Folder not found' }, { status: 404 })
          )
        );

        await store.dispatch(
          browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
        );

        await waitFor(() => {
          expect(clearDeletedDashboardsCacheSpy).toHaveBeenCalledTimes(1);
          expect(invalidateQuotaUsageSpy).toHaveBeenCalledTimes(1);
        });
      } finally {
        clearDeletedDashboardsCacheSpy.mockRestore();
        invalidateQuotaUsageSpy.mockRestore();
      }
    });

    it('refreshes parents for requested folders even when bulk delete yields no successes', async () => {
      const refetchParents: Array<string | undefined> = [];
      const starredSearchInvalidations: UnknownAction[] = [];
      const recorder: Middleware = () => (next) => (action) => {
        if (isAnyOf(refetchChildren.pending)(action)) {
          refetchParents.push(action.meta.arg.parentUID);
        }
        if (collectionsAPIv1alpha1.util.invalidateTags.match(action)) {
          starredSearchInvalidations.push(action);
        }
        return next(action);
      };
      const store = makeRecorderStore(recorder);

      server.use(
        http.delete('/api/folders/folder-1', () => HttpResponse.json({ message: 'Folder not found' }, { status: 404 })),
        http.delete('/api/folders/folder-2', () => HttpResponse.json({ message: 'Folder not found' }, { status: 404 }))
      );

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
      );

      // The requested folders have unknown parents, so their shared (root) parent is refreshed.
      await waitFor(() => {
        expect(refetchParents).toContain(undefined);
      });

      // Nothing was deleted, so the starred rows are not refetched.
      expect(starredSearchInvalidations).toEqual([]);
    });

    it('does not delete provisioned folders during bulk delete', async () => {
      const store = createTestStore();
      config.provisioningEnabled = true;

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

    it('invalidates the variables list after bulk-deleting folders', async () => {
      const store = createTestStore();
      const invalidateVariablesSpy = jest.spyOn(variablesManagementCache, 'invalidateVariablesAfterFolderDelete');

      try {
        server.use(http.delete('/api/folders/:uid', () => HttpResponse.json({})));

        await store.dispatch(
          browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
        );

        await waitFor(() => {
          expect(invalidateVariablesSpy).toHaveBeenCalledTimes(1);
        });
      } finally {
        invalidateVariablesSpy.mockRestore();
      }
    });

    it('invalidates the variables list when bulk delete yields no successes', async () => {
      const store = createTestStore();
      const invalidateVariablesSpy = jest.spyOn(variablesManagementCache, 'invalidateVariablesAfterFolderDelete');

      try {
        server.use(
          http.delete('/api/folders/folder-1', () =>
            HttpResponse.json({ message: 'Folder not found' }, { status: 404 })
          ),
          http.delete('/api/folders/folder-2', () =>
            HttpResponse.json({ message: 'Folder not found' }, { status: 404 })
          )
        );

        await store.dispatch(
          browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
        );

        await waitFor(() => {
          expect(invalidateVariablesSpy).toHaveBeenCalledTimes(1);
        });
      } finally {
        invalidateVariablesSpy.mockRestore();
      }
    });

    it('does not invalidate the variables list when bulk delete skips every folder as provisioned', async () => {
      const store = createTestStore();
      config.provisioningEnabled = true;
      const invalidateVariablesSpy = jest.spyOn(variablesManagementCache, 'invalidateVariablesAfterFolderDelete');

      try {
        server.use(
          http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:uid', () =>
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
          http.delete('/api/folders/:uid', () => HttpResponse.json({}))
        );

        await store.dispatch(browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1'] }));

        expect(invalidateVariablesSpy).not.toHaveBeenCalled();
      } finally {
        invalidateVariablesSpy.mockRestore();
      }
    });

    it('invalidates the starred search once for a bulk delete', async () => {
      const { store, invalidations } = createStoreWithStarredSearchRecorder();

      server.use(http.delete('/api/folders/:uid', () => HttpResponse.json({})));

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
      );

      await waitFor(() => {
        expect(invalidations).toEqual([invalidateStarredSearch()]);
      });
    });

    it('invalidates the starred search when some folders are provisioned', async () => {
      config.provisioningEnabled = true;
      const { store, invalidations } = createStoreWithStarredSearchRecorder();

      const deletedUids: string[] = [];

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
        http.get('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/folder-2', () =>
          HttpResponse.json({
            apiVersion: 'folder.grafana.app/v1beta1',
            kind: 'Folder',
            metadata: {
              name: 'folder-2',
              namespace: 'default',
            },
            spec: { title: 'Folder 2' },
          })
        ),
        http.delete('/api/folders/:uid', ({ params }) => {
          deletedUids.push(String(params.uid));
          return HttpResponse.json({});
        })
      );

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
      );

      await waitFor(() => {
        expect(deletedUids).toEqual(['folder-2']);
        expect(invalidations).toEqual([invalidateStarredSearch()]);
      });
    });

    it('invalidates the starred search when one delete in the batch fails', async () => {
      const { store, invalidations } = createStoreWithStarredSearchRecorder();

      const deleteFolder1Spy = jest.fn();
      const deleteFolder2Spy = jest.fn();

      server.use(
        http.delete('/api/folders/folder-1', () => {
          deleteFolder1Spy();
          return HttpResponse.json({ message: 'err' }, { status: 500 });
        }),
        http.delete('/api/folders/folder-2', () => {
          deleteFolder2Spy();
          return HttpResponse.json({});
        })
      );

      await store.dispatch(
        browseDashboardsAPI.endpoints.deleteFolders.initiate({ folderUIDs: ['folder-1', 'folder-2'] })
      );

      await waitFor(() => {
        expect(deleteFolder1Spy).toHaveBeenCalledTimes(1);
        expect(deleteFolder2Spy).toHaveBeenCalledTimes(1);
        expect(invalidations).toEqual([invalidateStarredSearch()]);
      });
    });
  });

  describe('saveDashboard refreshes folder children', () => {
    const dashboardUid = 'dash-1';
    const oldFolderUid = 'folder-old';
    const newFolderUid = 'folder-new';

    const createStoreWithRefetchSpy = () => {
      const refetchPendingArgs: Array<{ parentUID: string | undefined }> = [];
      const recorder: Middleware = () => (next) => (action) => {
        if (isAnyOf(refetchChildren.pending)(action)) {
          refetchPendingArgs.push({ parentUID: action.meta.arg.parentUID });
        }
        return next(action);
      };

      const store = makeRecorderStore(recorder);
      return { store, refetchPendingArgs };
    };

    const seedDashboardInFolder = (store: ReturnType<typeof createStoreWithRefetchSpy>['store']) => {
      // Populate childrenByParentUID[oldFolderUid] with the dashboard so getDashboardFolder finds it.
      store.dispatch(
        refetchChildren.fulfilled(
          {
            children: [
              {
                kind: 'dashboard',
                uid: dashboardUid,
                title: 'Test dashboard',
                parentUID: oldFolderUid,
              },
            ],
            kind: 'dashboard',
            page: 1,
            lastPageOfKind: true,
            generation: 0,
          },
          'test-request-id',
          { parentUID: oldFolderUid, pageSize: PAGE_SIZE }
        )
      );
    };

    beforeEach(() => {
      getDashboardAPIMock.mockImplementation(() =>
        createMockDashboardAPI(jest.fn().mockResolvedValue({ uid: dashboardUid }))
      );
    });

    it('refetches both new and previous parent folder when a v1 dashboard is moved', async () => {
      const { store, refetchPendingArgs } = createStoreWithRefetchSpy();
      seedDashboardInFolder(store);
      // Drop the seed action from the recorder so we only assert on saveDashboard's dispatches.
      refetchPendingArgs.length = 0;

      const cmd: SaveDashboardCommand<Dashboard> = {
        dashboard: { uid: dashboardUid, title: 'V1', panels: [], schemaVersion: 1 } as unknown as Dashboard,
        folderUid: newFolderUid,
      };

      await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

      await waitFor(() => {
        const parents = refetchPendingArgs.map((a) => a.parentUID);
        expect(parents).toHaveLength(2);
        expect(parents).toEqual(expect.arrayContaining([newFolderUid, oldFolderUid]));
      });
    });

    it('refetches both new and previous parent folder when a v2 dashboard is moved (uid from k8s.name)', async () => {
      const { store, refetchPendingArgs } = createStoreWithRefetchSpy();
      seedDashboardInFolder(store);
      refetchPendingArgs.length = 0;

      const v2Dashboard: DashboardV2Spec = { title: 'V2', elements: [] } as unknown as DashboardV2Spec;
      const cmd: SaveDashboardCommand<DashboardV2Spec> = {
        dashboard: v2Dashboard,
        folderUid: newFolderUid,
        k8s: { name: dashboardUid },
      };

      await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

      await waitFor(() => {
        const parents = refetchPendingArgs.map((a) => a.parentUID);
        expect(parents).toHaveLength(2);
        expect(parents).toEqual(expect.arrayContaining([newFolderUid, oldFolderUid]));
      });
    });

    it('only refetches the target folder when the dashboard is saved to the same folder', async () => {
      const { store, refetchPendingArgs } = createStoreWithRefetchSpy();
      seedDashboardInFolder(store);
      refetchPendingArgs.length = 0;

      const cmd: SaveDashboardCommand<Dashboard> = {
        dashboard: { uid: dashboardUid, title: 'V1', panels: [], schemaVersion: 1 } as unknown as Dashboard,
        folderUid: oldFolderUid,
      };

      await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

      await waitFor(() => {
        expect(refetchPendingArgs).toEqual([{ parentUID: oldFolderUid }]);
      });
    });

    it('does not look up a previous folder when the dashboard is unknown to the store', async () => {
      const { store, refetchPendingArgs } = createStoreWithRefetchSpy();
      // No seedDashboardInFolder — store has no record of dashboardUid.

      const cmd: SaveDashboardCommand<Dashboard> = {
        dashboard: { uid: dashboardUid, title: 'V1', panels: [], schemaVersion: 1 } as unknown as Dashboard,
        folderUid: newFolderUid,
      };

      await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));

      await waitFor(() => {
        expect(refetchPendingArgs).toEqual([{ parentUID: newFolderUid }]);
      });
    });
  });

  describe('saveDashboard starred rows', () => {
    const dashboardUid = 'dash-1';

    // Records the children refetch the save dispatches just before deciding on the starred rows
    const createStoreWithSaveRecorder = () => {
      const invalidations: UnknownAction[] = [];
      const refetches: UnknownAction[] = [];
      const recorder: Middleware = () => (next) => (action) => {
        if (collectionsAPIv1alpha1.util.invalidateTags.match(action)) {
          invalidations.push(action);
        }
        if (refetchChildren.pending.match(action)) {
          refetches.push(action);
        }
        return next(action);
      };
      return { store: makeRecorderStore(recorder), invalidations, refetches };
    };

    const saveDashboard = async (store: ReturnType<typeof makeRecorderStore>) => {
      // The star set as a mounted view would have cached it
      await store.dispatch(
        collectionsAPIv1alpha1.endpoints.listStars.initiate({ fieldSelector: userStarsFieldSelector() })
      );
      const cmd: SaveDashboardCommand<Dashboard> = {
        dashboard: { uid: dashboardUid, title: 'Renamed', panels: [], schemaVersion: 1 } as unknown as Dashboard,
        folderUid: 'folder-1',
      };
      await store.dispatch(browseDashboardsAPI.endpoints.saveDashboard.initiate(cmd));
    };

    beforeEach(() => {
      getDashboardAPIMock.mockImplementation(() =>
        createMockDashboardAPI(jest.fn().mockResolvedValue({ uid: dashboardUid }))
      );
    });

    it('re-searches the starred rows after saving a starred dashboard', async () => {
      setMockStarredDashboards([dashboardUid]);
      const { store, invalidations } = createStoreWithSaveRecorder();

      await saveDashboard(store);

      await waitFor(() => expect(invalidations).toEqual([invalidateStarredSearch()]));
    });

    it('leaves the starred rows alone after saving an unstarred dashboard', async () => {
      setMockStarredDashboards(['another-dashboard']);
      const { store, invalidations, refetches } = createStoreWithSaveRecorder();

      await saveDashboard(store);

      // The children refetch precedes the decision on the rows in the same callback, so by now it has been made
      await waitFor(() => expect(refetches).toHaveLength(1));
      expect(invalidations).toEqual([]);
    });
  });
});
