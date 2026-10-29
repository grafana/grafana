import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';
import { act, renderHook, getWrapper, waitFor, screen } from 'test/test-utils';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { config, setAppEvents, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { folderHandlers, getFolderFixtures, setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { type StoreState } from 'app/types/store';

import { AnnoKeyFolder, AnnoKeyGrantPermissions } from '../../../../features/apiserver/types';

import {
  useGetFolderQueryFacade,
  useDeleteMultipleFoldersMutationFacade,
  useMoveMultipleFoldersMutationFacade,
  getFolderByUidFacade,
  getFolderUrl,
} from './hooks';
import { getWrapperWithNotifications, setupCreateFolder, setupUpdateFolder } from './test-utils';

setAppEvents(appEvents);
setBackendSrv(backendSrv);
setupMockServer();

const [_, { folderA, folderA_folderA, folderB }] = getFolderFixtures();

const expectedUid = folderA_folderA.item.uid;
const expectedTitle = folderA_folderA.item.title;
const urlSlug = expectedTitle.toLowerCase().replace(/ /g, '-').replace(/[\.]/g, '');
const expectedUrl = `/grafana/dashboards/f/${expectedUid}/${urlSlug}`;

const parentUrlSlug = folderA.item.title.toLowerCase().replace(/ /g, '-').replace(/[\.]/g, '');
const expectedParentUrl = `/grafana/dashboards/f/${folderA.item.uid}/${parentUrlSlug}`;

const renderFolderHook = async () => {
  const { result } = renderHook(() => useGetFolderQueryFacade(folderA_folderA.item.uid), {
    wrapper: getWrapper({}),
  });
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
  return result;
};

const setupUpdateFolderHandler = (onPatch?: jest.Mock) => {
  folderAPIVersionResolver.set('v1beta1');
  server.use(
    http.patch('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name', async ({ params, request }) => {
      const body = await request.json();
      onPatch?.({ name: params.name, body });

      return HttpResponse.json({
        apiVersion: 'folder.grafana.app/v1beta1',
        kind: 'Folder',
        metadata: {
          name: params.name,
          generation: 1,
        },
        spec: {
          title:
            body && typeof body === 'object' && 'spec' in body
              ? (body.spec?.title ?? 'Updated Folder')
              : 'Updated Folder',
        },
      });
    })
  );
};

const setupCreateFolderHandler = (onCreate?: jest.Mock) => {
  folderAPIVersionResolver.set('v1beta1');
  server.use(
    http.post('/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders', async ({ request }) => {
      const body = await request.json();
      onCreate?.(body);

      return HttpResponse.json({
        apiVersion: 'folder.grafana.app/v1beta1',
        kind: 'Folder',
        metadata: {
          name: 'new-folder-uid',
          generation: 1,
        },
        spec: {
          title: body && typeof body === 'object' && 'spec' in body ? (body.spec?.title ?? 'test') : 'test',
        },
      });
    })
  );
};

const setupDeleteFolderHandler = (onDelete: jest.Mock) => {
  server.use(
    http.delete('/api/folders/:uid', ({ params }) => {
      onDelete(params.uid);
      return HttpResponse.json({});
    })
  );
};

const setupMoveFolderHandler = (onMove: jest.Mock) => {
  server.use(
    http.post('/api/folders/:uid/move', async ({ params, request }) => {
      onMove({ uid: params.uid, body: await request.json() });
      return HttpResponse.json({});
    })
  );
};

// Mutations kick off browse-tree refetches after they resolve. Waiting for the refetched collection both asserts the
// refresh and keeps the request from being in flight when MSW resets handlers between tests.
const expectChildrenRefetched = (store: Store<StoreState>, parentUID: string | undefined, expectedChildUid: string) =>
  waitFor(() => {
    const { rootItems, childrenByParentUID } = store.getState().browseDashboards;
    const collection = parentUID ? childrenByParentUID[parentUID] : rootItems;
    expect(collection?.items.map((item) => item.uid)).toContain(expectedChildUid);
  });

// Legacy folder mutations also refetch the virtual team folders; the default /api/user/teams handler has no teams.
const expectTeamFoldersRefetched = (store: Store<StoreState>) =>
  waitFor(() => expect(store.getState().browseDashboards.childrenByParentUID[TEAM_FOLDERS_UID]?.items).toEqual([]));

const originalProvisioningEnabled = config.provisioningEnabled;
const originalPermissions = contextSrv.user.permissions;

beforeEach(() => {
  config.provisioningEnabled = false;
  // Browse-tree refetches skip the folder list without folders:read, which would leave the refresh assertions below
  // passing on dashboards alone.
  contextSrv.user.permissions = { [AccessControlAction.FoldersRead]: true };
});

afterEach(async () => {
  config.provisioningEnabled = originalProvisioningEnabled;
  contextSrv.user.permissions = originalPermissions;
  // setTestFlags mutates a module-level provider, so reset it for every test. The act wrap is needed
  // because the reset fires OpenFeature events while components are still mounted.
  await act(async () => {
    setTestFlags({});
  });
});

describe('useGetFolderQueryFacade', () => {
  const originalAppSubUrl = String(config.appSubUrl);
  const originalSharedWithMeFolderUID = config.sharedWithMeFolderUID;

  beforeEach(() => {
    config.appSubUrl = '/grafana';
  });

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
    config.sharedWithMeFolderUID = originalSharedWithMeFolderUID;
  });

  it('merges multiple responses into a single FolderDTO-like object if flag is true', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });

    const result = await renderFolderHook();

    expect(result.current.data).toMatchObject({
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      created: '2023-01-01T00:00:00Z',
      createdBy: 'User 1',
      hasAcl: false,
      id: 123,
      parentUid: folderA.item.uid,
      managedBy: 'user',
      title: expectedTitle,
      uid: expectedUid,
      updated: '2024-01-01T00:00:00Z',
      updatedBy: 'User 2',
      url: expectedUrl,
      version: 1,
      accessControl: {
        'dashboards.permissions:write': true,
        'dashboards:create': true,
      },
      parents: [
        {
          title: folderA.item.title,
          uid: folderA.item.uid,
          url: expectedParentUrl,
        },
      ],
    });
  });

  it('runs a real access query for the root/general virtual folder', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });

    const { result } = renderHook(() => useGetFolderQueryFacade('general'), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toMatchObject({
      uid: 'general',
      title: 'Dashboards',
      // The root folder has no URL — the backend leaves it blank.
      url: '',
      // Access comes from the real access query rather than being hardcoded to "no access".
      canAdmin: true,
      canDelete: true,
      canEdit: true,
      canSave: true,
      accessControl: {
        'dashboards.permissions:write': true,
        'dashboards:create': true,
        'folders:write': true,
      },
    });
    // Virtual folders have no parents.
    expect(result.current.data?.parents).toBeUndefined();
  });

  it('runs a real access query for the sharedwithme virtual folder (no access)', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });
    config.sharedWithMeFolderUID = 'sharedwithme';

    const { result } = renderHook(() => useGetFolderQueryFacade('sharedwithme'), {
      wrapper: getWrapper({}),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toMatchObject({
      uid: 'sharedwithme',
      title: 'Shared with me',
      canAdmin: false,
      canDelete: false,
      canEdit: false,
      canSave: false,
    });
    expect(result.current.data?.accessControl).toBeUndefined();
  });

  it('returns legacy folder response if flag is false', async () => {
    setTestFlags({ foldersAppPlatformAPI: false });
    const result = await renderFolderHook();
    expect(result.current.data).toMatchObject({
      id: 791,
      title: folderA_folderA.item.title,
      url: expectedUrl,
      uid: expectedUid,
      orgId: 1,
      hasAcl: false,
      canSave: true,
      canEdit: true,
      canAdmin: true,
      canDelete: true,
      createdBy: 'Anonymous',
      created: '2025-07-14T12:07:36+02:00',
      updatedBy: 'Anonymous',
      updated: '2025-07-15T18:01:36+02:00',
      version: 1,
      accessControl: {
        'dashboards.permissions:write': true,
        'dashboards:create': true,
      },
    });
  });

  it.each([true, false])(
    'stops reporting a folder once the uid is cleared (foldersAppPlatformAPI: %s)',
    async (foldersAppPlatformAPI) => {
      setTestFlags({ foldersAppPlatformAPI });
      const initialProps: { uid?: string } = { uid: folderA_folderA.item.uid };
      const { result, rerender } = renderHook(({ uid }: { uid?: string }) => useGetFolderQueryFacade(uid), {
        wrapper: getWrapper({}),
        initialProps,
      });
      await waitFor(() => expect(result.current.data).toBeDefined());

      rerender({ uid: undefined });

      expect(result.current.data).toBeUndefined();
    }
  );
});

describe('useDeleteMultipleFoldersMutationFacade', () => {
  // RTK Query logs a console.error because the legacy deleteFolders queryFn resolves { data: undefined }. Pin that one
  // call so any other error (unhandled request, failed refetch) still fails the test.
  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('deletes each folder through the legacy API when the flag is on (app platform delete is not supported yet)', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });
    const deleteSpy = jest.fn();
    setupDeleteFolderHandler(deleteSpy);
    const store = configureStore();
    const folderUIDs = ['uid1', 'uid2'];
    const { result } = renderHook(() => useDeleteMultipleFoldersMutationFacade(), {
      wrapper: getWrapper({ store }),
    });
    await act(async () => {
      await result.current({ folderUIDs });
    });

    expect(deleteSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenNthCalledWith(1, 'uid1');
    expect(deleteSpy).toHaveBeenNthCalledWith(2, 'uid2');
    // deleted uids are unknown to the tree, so refreshParents falls back to the root
    await expectChildrenRefetched(store, undefined, folderA.item.uid);
    await expectTeamFoldersRefetched(store);
    expect(consoleErrorSpy.mock.calls).toEqual([
      [expect.stringContaining('Error encountered handling the endpoint deleteFolders'), { data: undefined }],
    ]);
  });

  it('uses legacy call when flag is false', async () => {
    setTestFlags({ foldersAppPlatformAPI: false });
    const deleteSpy = jest.fn();
    setupDeleteFolderHandler(deleteSpy);
    const store = configureStore();
    const folderUIDs = ['uid1', 'uid2'];
    const { result } = renderHook(() => useDeleteMultipleFoldersMutationFacade(), {
      wrapper: getWrapper({ store }),
    });
    await act(async () => {
      await result.current({ folderUIDs });
    });

    expect(deleteSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenNthCalledWith(1, 'uid1');
    expect(deleteSpy).toHaveBeenNthCalledWith(2, 'uid2');
    // deleted uids are unknown to the tree, so refreshParents falls back to the root
    await expectChildrenRefetched(store, undefined, folderA.item.uid);
    await expectTeamFoldersRefetched(store);
    expect(consoleErrorSpy.mock.calls).toEqual([
      [expect.stringContaining('Error encountered handling the endpoint deleteFolders'), { data: undefined }],
    ]);
  });
});

describe('useMoveMultipleFoldersMutationFacade', () => {
  const patchSpy = jest.fn();
  // RTK Query logs a console.error because the legacy moveFolders queryFn resolves { data: undefined }; the app
  // platform path has no such noise, so each test pins what it expects on the spy.
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    patchSpy.mockReset();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
    folderAPIVersionResolver.reset();
  });

  it('moves multiple folders and publishes success alert', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });
    setupUpdateFolderHandler(patchSpy);
    const folderUIDs = ['uid1', 'uid2'];
    const destinationUID = folderA.item.uid;
    const store = configureStore();
    const { result } = renderHook(() => useMoveMultipleFoldersMutationFacade(), {
      wrapper: getWrapperWithNotifications(store),
    });
    await act(async () => {
      await result.current[0]({ folderUIDs, destinationUID });
    });

    expect(patchSpy).toHaveBeenCalledTimes(folderUIDs.length);
    expect(patchSpy).toHaveBeenCalledWith({
      name: 'uid1',
      body: { metadata: { annotations: { [AnnoKeyFolder]: destinationUID } } },
    });
    expect(patchSpy).toHaveBeenCalledWith({
      name: 'uid2',
      body: { metadata: { annotations: { [AnnoKeyFolder]: destinationUID } } },
    });

    expect(await screen.findByText('Folder moved')).toBeInTheDocument();

    // useRefreshFolders refetches the destination's children and, for the (unknown) moved uids, the root
    await expectChildrenRefetched(store, destinationUID, folderA_folderA.item.uid);
    await expectChildrenRefetched(store, undefined, folderB.item.uid);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('uses legacy call when flag is false', async () => {
    setTestFlags({ foldersAppPlatformAPI: false });
    const moveSpy = jest.fn();
    setupMoveFolderHandler(moveSpy);
    const folderUIDs = ['uid1', 'uid2'];
    const destinationUID = folderA.item.uid;
    const store = configureStore();
    const { result } = renderHook(() => useMoveMultipleFoldersMutationFacade(), {
      wrapper: getWrapper({ store }),
    });
    await act(async () => {
      await result.current[0]({ folderUIDs, destinationUID });
    });

    expect(moveSpy).toHaveBeenCalledTimes(2);
    expect(moveSpy).toHaveBeenNthCalledWith(1, { uid: 'uid1', body: { parentUID: destinationUID } });
    expect(moveSpy).toHaveBeenNthCalledWith(2, { uid: 'uid2', body: { parentUID: destinationUID } });
    await expectChildrenRefetched(store, destinationUID, folderA_folderA.item.uid);
    await expectChildrenRefetched(store, undefined, folderB.item.uid);
    await expectTeamFoldersRefetched(store);
    expect(consoleErrorSpy.mock.calls).toEqual([
      [expect.stringContaining('Error encountered handling the endpoint moveFolders'), { data: undefined }],
    ]);
  });
});

describe.each([
  // app platform
  true,
  // legacy
  false,
])('folderAppPlatformAPI toggle set to: %s', (toggle) => {
  beforeEach(() => {
    setTestFlags({ foldersAppPlatformAPI: toggle });
    if (toggle) {
      folderAPIVersionResolver.set('v1beta1');
    }
  });
  afterEach(() => {
    folderAPIVersionResolver.reset();
  });

  describe('useCreateFolder', () => {
    it('creates a folder at the root level', async () => {
      const { user, store } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder at root/));

      expect(await screen.findByText('Folder created')).toBeInTheDocument();
      await expectChildrenRefetched(store, undefined, folderA.item.uid);
      if (!toggle) {
        await expectTeamFoldersRefetched(store);
      }
    });

    it('creates a folder in a nested folder', async () => {
      const { user, store } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder in nested folder/));

      expect(await screen.findByText('Folder created')).toBeInTheDocument();
      await expectChildrenRefetched(store, folderA.item.uid, folderA_folderA.item.uid);
      if (!toggle) {
        await expectTeamFoldersRefetched(store);
      }
    });

    it('sets grant-permissions annotation when creating a root folder via the app platform API', async () => {
      if (!toggle) {
        return;
      }

      const createSpy = jest.fn();
      setupCreateFolderHandler(createSpy);
      const { user, store } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder at root/));

      await waitFor(() => expect(createSpy).toHaveBeenCalled());
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            annotations: { [AnnoKeyGrantPermissions]: 'default' },
          }),
        })
      );
      await expectChildrenRefetched(store, undefined, folderA.item.uid);
    });

    it('sets folder annotation when creating a nested folder via the app platform API', async () => {
      if (!toggle) {
        return;
      }

      const createSpy = jest.fn();
      setupCreateFolderHandler(createSpy);
      const { user, store } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder in nested folder/));

      await waitFor(() => expect(createSpy).toHaveBeenCalled());
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            annotations: { [AnnoKeyFolder]: folderA.item.uid },
          }),
        })
      );
      expect(createSpy.mock.calls[0][0].metadata.annotations[AnnoKeyGrantPermissions]).toBeUndefined();
      await expectChildrenRefetched(store, folderA.item.uid, folderA_folderA.item.uid);
    });
  });

  describe('useUpdateFolder', () => {
    beforeEach(() => {
      setupUpdateFolderHandler();
    });

    it('updates a folder', async () => {
      const { user, store } = await setupUpdateFolder(folderA_folderA.item.uid);

      await user.type(screen.getByLabelText('Folder Title'), 'Updated Folder');
      await user.click(screen.getByText('Update Folder'));

      expect(await screen.findByText('Folder updated')).toBeInTheDocument();
      // the test component passes no parentUid, so the refresh targets the root
      await expectChildrenRefetched(store, undefined, folderA.item.uid);
      if (!toggle) {
        await expectTeamFoldersRefetched(store);
      }
    });
  });
});

describe('useUpdateFolder app-platform starred nav update', () => {
  const originalAppSubUrl = String(config.appSubUrl);

  beforeEach(() => {
    config.appSubUrl = '';
    setTestFlags({ foldersAppPlatformAPI: true });
    folderAPIVersionResolver.set('v1beta1');
    setupUpdateFolderHandler();
  });

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
    folderAPIVersionResolver.set('v1beta1');
  });

  it('updates the starred folder title and URL after rename', async () => {
    const uid = folderA_folderA.item.uid;
    const store = configureStore({
      navBarTree: [
        { id: 'starred', text: 'Starred', children: [{ id: ID_PREFIX + uid, text: 'Old title', url: '/old' }] },
      ],
    });
    const { user } = await setupUpdateFolder(uid, store);

    await user.clear(screen.getByLabelText('Folder Title'));
    await user.type(screen.getByLabelText('Folder Title'), 'Updated Folder');
    await user.click(screen.getByText('Update Folder'));

    expect(await screen.findByText('Folder updated')).toBeInTheDocument();
    await waitFor(() =>
      expect(store.getState().navBarTree.find((item) => item.id === 'starred')?.children).toEqual([
        { id: ID_PREFIX + uid, text: 'Updated Folder', url: `/dashboards/f/${uid}/` },
      ])
    );
    await expectChildrenRefetched(store, undefined, folderA.item.uid);
  });
});

describe('getFolderByUidFacade', () => {
  beforeEach(() => {
    // getFolderByUidFacade dispatches on the global store, so register a fresh one per test
    configureStore();
    folderAPIVersionResolver.set('v1beta1');
  });
  afterEach(() => {
    folderAPIVersionResolver.reset();
  });

  it('throws the original error with HTTP status when folder API returns 403 and foldersAppPlatformAPI is enabled', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });
    server.use(
      http.get(folderHandlers.FOLDER_BY_NAME, () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 }))
    );

    await expect(getFolderByUidFacade(folderA_folderA.item.uid)).rejects.toHaveProperty('status', 403);
  });

  it('throws the original error with HTTP status when folder API returns 403 and foldersAppPlatformAPI is disabled', async () => {
    setTestFlags({ foldersAppPlatformAPI: false });
    server.use(http.get('/api/folders/:uid', () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })));

    await expect(getFolderByUidFacade(folderA_folderA.item.uid)).rejects.toHaveProperty('status', 403);
  });

  it('throws a generic error when the folder API returns empty bodies', async () => {
    setTestFlags({ foldersAppPlatformAPI: true });
    server.use(
      http.get(folderHandlers.FOLDER_BY_NAME, () => new HttpResponse(null)),
      http.get(`${folderHandlers.FOLDER_BY_NAME}/access`, () => new HttpResponse(null)),
      http.get(`${folderHandlers.FOLDER_BY_NAME}/parents`, () => new HttpResponse(null))
    );

    await expect(getFolderByUidFacade(folderA_folderA.item.uid)).rejects.toThrow(
      'One of the folder responses is undefined'
    );
  });
});

describe('getFolderUrl', () => {
  const originalAppSubUrl = String(config.appSubUrl);

  beforeEach(() => {
    config.appSubUrl = '/grafana';
  });

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
  });

  it('returns a slug derived from a Latin title', () => {
    expect(getFolderUrl('abc123', 'My Folder')).toBe('/grafana/dashboards/f/abc123/my-folder');
  });

  it('falls back to uid when title is CJK-only', () => {
    expect(getFolderUrl('abc123', 'テストフォルダ')).toBe('/grafana/dashboards/f/abc123/abc123');
  });

  it('falls back to uid when title is Cyrillic-only', () => {
    expect(getFolderUrl('abc123', 'Тест')).toBe('/grafana/dashboards/f/abc123/abc123');
  });

  it('falls back to uid when title is Arabic-only', () => {
    expect(getFolderUrl('abc123', 'مجلد')).toBe('/grafana/dashboards/f/abc123/abc123');
  });

  it('uses the Latin portion of a mixed title', () => {
    expect(getFolderUrl('abc123', 'テスト Folder')).toBe('/grafana/dashboards/f/abc123/folder');
  });

  it('falls back to uid when title is empty', () => {
    expect(getFolderUrl('abc123', '')).toBe('/grafana/dashboards/f/abc123/abc123');
  });

  it('respects appSubUrl', () => {
    config.appSubUrl = '/custom';
    expect(getFolderUrl('uid1', 'Test')).toBe('/custom/dashboards/f/uid1/test');
  });

  it('works with empty appSubUrl', () => {
    config.appSubUrl = '';
    expect(getFolderUrl('uid1', 'Test')).toBe('/dashboards/f/uid1/test');
  });
});
