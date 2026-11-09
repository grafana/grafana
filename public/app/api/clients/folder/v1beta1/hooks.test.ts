import { http, HttpResponse } from 'msw';
import { type Store } from 'redux';
import { act, renderHook, getWrapper, waitFor, screen } from 'test/test-utils';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { config, setAppEvents, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { folderHandlers, getFolderFixtures } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { type StoreState } from 'app/types/store';

import { AnnoKeyFolder, AnnoKeyGrantPermissions } from '../../../../features/apiserver/types';

import { useGetCombinedFolderQuery, useMoveFolders, getCombinedFolder, getFolderUrl } from './hooks';
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
  const { result } = renderHook(() => useGetCombinedFolderQuery(folderA_folderA.item.uid), {
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

// Mutations kick off browse-tree refetches after they resolve. Waiting for the refetched collection both asserts the
// refresh and keeps the request from being in flight when MSW resets handlers between tests.
const expectChildrenRefetched = (store: Store<StoreState>, parentUID: string | undefined, expectedChildUid: string) =>
  waitFor(() => {
    const { rootItems, childrenByParentUID } = store.getState().browseDashboards;
    const collection = parentUID ? childrenByParentUID[parentUID] : rootItems;
    expect(collection?.items.map((item) => item.uid)).toContain(expectedChildUid);
  });

const originalProvisioningEnabled = config.provisioningEnabled;
const originalPermissions = contextSrv.user.permissions;

beforeEach(() => {
  config.provisioningEnabled = false;
  // Browse-tree refetches skip the folder list without folders:read, which would leave the refresh assertions below
  // passing on dashboards alone.
  contextSrv.user.permissions = { [AccessControlAction.FoldersRead]: true };
});

afterEach(() => {
  config.provisioningEnabled = originalProvisioningEnabled;
  contextSrv.user.permissions = originalPermissions;
});

describe('useGetCombinedFolderQuery', () => {
  const originalAppSubUrl = String(config.appSubUrl);
  const originalSharedWithMeFolderUID = config.sharedWithMeFolderUID;

  beforeEach(() => {
    config.appSubUrl = '/grafana';
  });

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
    config.sharedWithMeFolderUID = originalSharedWithMeFolderUID;
  });

  it('merges multiple responses into a single FolderDTO-like object', async () => {
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

  it('returns the folder with anonymous users when the user names cannot be looked up', async () => {
    server.use(
      http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/display', () =>
        HttpResponse.json(
          { kind: 'Status', apiVersion: 'v1', status: 'Failure', reason: 'Forbidden', code: 403 },
          { status: 403 }
        )
      )
    );

    const result = await renderFolderHook();

    expect(result.current.data).toMatchObject({
      uid: expectedUid,
      title: expectedTitle,
      canEdit: true,
      createdBy: 'Anonymous',
      updatedBy: 'Anonymous',
    });
    // The folder picker disables itself on a 403, as if the viewer had no access to the folder.
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('runs a real access query for the root/general virtual folder', async () => {
    const { result } = renderHook(() => useGetCombinedFolderQuery('general'), {
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
    config.sharedWithMeFolderUID = 'sharedwithme';

    const { result } = renderHook(() => useGetCombinedFolderQuery('sharedwithme'), {
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

  it('stops reporting a folder once the uid is cleared', async () => {
    const initialProps: { uid?: string } = { uid: folderA_folderA.item.uid };
    const { result, rerender } = renderHook(({ uid }: { uid?: string }) => useGetCombinedFolderQuery(uid), {
      wrapper: getWrapper({}),
      initialProps,
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ uid: undefined });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useMoveFolders', () => {
  const patchSpy = jest.fn();
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
    setupUpdateFolderHandler(patchSpy);
    const folderUIDs = ['uid1', 'uid2'];
    const destinationUID = folderA.item.uid;
    const store = configureStore();
    const { result } = renderHook(() => useMoveFolders(), {
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
});

describe('app platform folder create/update', () => {
  beforeEach(() => {
    folderAPIVersionResolver.set('v1beta1');
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
    });

    it('creates a folder in a nested folder', async () => {
      const { user, store } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder in nested folder/));

      expect(await screen.findByText('Folder created')).toBeInTheDocument();
      await expectChildrenRefetched(store, folderA.item.uid, folderA_folderA.item.uid);
    });

    it('sets grant-permissions annotation when creating a root folder via the app platform API', async () => {
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
    });
  });
});

describe('useUpdateFolder app-platform starred nav update', () => {
  const originalAppSubUrl = String(config.appSubUrl);

  beforeEach(() => {
    config.appSubUrl = '';
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

describe('getCombinedFolder', () => {
  beforeEach(() => {
    // getCombinedFolder dispatches on the global store, so register a fresh one per test
    configureStore();
    folderAPIVersionResolver.set('v1beta1');
  });
  afterEach(() => {
    folderAPIVersionResolver.reset();
  });

  it('throws the original error with HTTP status when the folder API returns 403', async () => {
    server.use(
      http.get(folderHandlers.FOLDER_BY_NAME, () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 }))
    );

    await expect(getCombinedFolder(folderA_folderA.item.uid)).rejects.toHaveProperty('status', 403);
  });

  it('throws a generic error when the folder API returns empty bodies', async () => {
    server.use(
      http.get(folderHandlers.FOLDER_BY_NAME, () => new HttpResponse(null)),
      http.get(`${folderHandlers.FOLDER_BY_NAME}/access`, () => new HttpResponse(null)),
      http.get(`${folderHandlers.FOLDER_BY_NAME}/parents`, () => new HttpResponse(null))
    );

    await expect(getCombinedFolder(folderA_folderA.item.uid)).rejects.toThrow(
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
