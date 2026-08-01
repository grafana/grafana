import { http, HttpResponse } from 'msw';
import { act, renderHook, getWrapper, waitFor, screen } from 'test/test-utils';

import { folderAPIVersionResolver } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { AppEvents } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  useDeleteFoldersMutation as useDeleteFoldersMutationLegacy,
  useMoveFoldersMutation as useMoveFoldersMutationLegacy,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { getFolderURL as getStarredFolderURL } from 'app/features/browse-dashboards/utils/dashboards';

import { AnnoKeyFolder, AnnoKeyGrantPermissions } from '../../../../features/apiserver/types';

import {
  useGetFolderQueryFacade,
  useDeleteMultipleFoldersMutationFacade,
  useMoveMultipleFoldersMutationFacade,
  getFolderByUidFacade,
  getFolderUrl,
} from './hooks';
import { setupCreateFolder, setupUpdateFolder } from './test-utils';

import { useDeleteFolderMutation } from './index';

// Mocks for the hooks used inside useGetFolderQueryFacade
jest.mock('./index', () => ({
  ...jest.requireActual('./index'),
  useDeleteFolderMutation: jest.fn(),
}));

const publishMockFn = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: publishMockFn,
  })),
}));

jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/browseDashboardsAPI'),
  useDeleteFoldersMutation: jest.fn(),
  useMoveFoldersMutation: jest.fn(),
}));

const dispatchMockFn = jest.fn();
jest.mock('../../../../types/store', () => {
  return {
    ...jest.requireActual('../../../../types/store'),
    dispatch: (...args: unknown[]) => dispatchMockFn(...args),
    useDispatch: () => dispatchMockFn,
  };
});

// The folder mutations refresh the team folders tree as a side effect. listTeamFolders would error
// here because this test mocks the app dispatch, so stub it out.
jest.mock('app/features/browse-dashboards/api/services', () => ({
  ...jest.requireActual('app/features/browse-dashboards/api/services'),
  listTeamFolders: jest.fn(async () => []),
}));

setBackendSrv(backendSrv);
setupMockServer();

const [_, { folderA, folderA_folderA }] = getFolderFixtures();

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

const originalToggles = { ...config.featureToggles };
afterAll(() => {
  // Restore the original feature toggle value changed during tests
  config.featureToggles = originalToggles;
});

describe('useGetFolderQueryFacade', () => {
  const originalAppSubUrl = String(config.appSubUrl);
  const originalSharedWithMeFolderUID = config.sharedWithMeFolderUID;

  beforeEach(() => {
    config.appSubUrl = '/grafana';
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
    config.appSubUrl = originalAppSubUrl;
    config.sharedWithMeFolderUID = originalSharedWithMeFolderUID;
  });

  it('merges multiple responses into a single FolderDTO-like object if flag is true', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;

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
    config.featureToggles.foldersAppPlatformAPI = true;

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
    config.featureToggles.foldersAppPlatformAPI = true;
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
    config.featureToggles.foldersAppPlatformAPI = false;
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
});

describe('useDeleteMultipleFoldersMutationFacade', () => {
  const mockDeleteFolder = jest.fn(() => ({ error: undefined }));
  const mockDeleteFolderLegacy = jest.fn(() => ({ error: undefined }));

  beforeEach(() => {
    jest.clearAllMocks();
    (useDeleteFolderMutation as jest.Mock).mockReturnValue([mockDeleteFolder]);
    (useDeleteFoldersMutationLegacy as jest.Mock).mockReturnValue([mockDeleteFolderLegacy]);
  });

  it('deletes multiple folders and publishes success alert', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;
    // Same test as for legacy as right now we always use legacy API for deletes.
    const folderUIDs = ['uid1', 'uid2'];
    const deleteFolders = useDeleteMultipleFoldersMutationFacade();
    await deleteFolders({ folderUIDs });

    // Should call deleteFolder for each UID
    expect(mockDeleteFolderLegacy).toHaveBeenCalledTimes(1);
    expect(mockDeleteFolderLegacy).toHaveBeenCalledWith({ folderUIDs });
  });

  it('uses legacy call when flag is false', async () => {
    config.featureToggles.foldersAppPlatformAPI = false;
    const folderUIDs = ['uid1', 'uid2'];
    const deleteFolders = useDeleteMultipleFoldersMutationFacade();
    await deleteFolders({ folderUIDs });

    // Should call deleteFolder for each UID
    expect(mockDeleteFolderLegacy).toHaveBeenCalledTimes(1);
    expect(mockDeleteFolderLegacy).toHaveBeenCalledWith({ folderUIDs });
  });
});

describe('useMoveMultipleFoldersMutationFacade', () => {
  const mockMoveFolders = jest.fn(() => ({ error: undefined }));
  const patchSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useMoveFoldersMutationLegacy as jest.Mock).mockReturnValue([mockMoveFolders]);
    patchSpy.mockReset();
  });
  afterEach(() => {
    folderAPIVersionResolver.reset();
  });

  it('moves multiple folders and publishes success alert', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;
    setupUpdateFolderHandler(patchSpy);
    const folderUIDs = ['uid1', 'uid2'];
    const { result } = renderHook(() => useMoveMultipleFoldersMutationFacade(), {
      wrapper: getWrapper({}),
    });
    await act(async () => {
      await result.current[0]({ folderUIDs, destinationUID: 'uid3' });
    });

    expect(patchSpy).toHaveBeenCalledTimes(folderUIDs.length);
    expect(patchSpy).toHaveBeenCalledWith({
      name: 'uid1',
      body: { metadata: { annotations: { [AnnoKeyFolder]: 'uid3' } } },
    });
    expect(patchSpy).toHaveBeenCalledWith({
      name: 'uid2',
      body: { metadata: { annotations: { [AnnoKeyFolder]: 'uid3' } } },
    });

    // Should publish a success alert
    expect(publishMockFn).toHaveBeenCalledWith({
      type: AppEvents.alertSuccess.name,
      payload: ['Folder moved'],
    });

    // Should dispatch refreshParents
    expect(dispatchMockFn).toHaveBeenCalled();
  });

  it('uses legacy call when flag is false', async () => {
    config.featureToggles.foldersAppPlatformAPI = false;
    const folderUIDs = ['uid1', 'uid2'];
    const { result } = renderHook(() => useMoveMultipleFoldersMutationFacade(), {
      wrapper: getWrapper({}),
    });
    await act(async () => {
      await result.current[0]({ folderUIDs, destinationUID: 'uid3' });
    });

    // Should call deleteFolder for each UID
    expect(mockMoveFolders).toHaveBeenCalledTimes(1);
    expect(mockMoveFolders).toHaveBeenCalledWith({ folderUIDs, destinationUID: 'uid3' });
  });
});

describe.each([
  // app platform
  true,
  // legacy
  false,
])('folderAppPlatformAPI toggle set to: %s', (toggle) => {
  beforeEach(() => {
    config.featureToggles.foldersAppPlatformAPI = toggle;
    if (toggle) {
      folderAPIVersionResolver.set('v1beta1');
    }
  });
  afterEach(() => {
    config.featureToggles = originalToggles;
    folderAPIVersionResolver.reset();
  });

  describe('useCreateFolder', () => {
    it('creates a folder at the root level', async () => {
      const { user } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder at root/));

      expect(await screen.findByText('Folder created')).toBeInTheDocument();
      expect(dispatchMockFn).toHaveBeenCalled();
    });

    it('creates a folder in a nested folder', async () => {
      const { user } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder in nested folder/));

      expect(await screen.findByText('Folder created')).toBeInTheDocument();
      expect(dispatchMockFn).toHaveBeenCalled();
    });

    it('sets grant-permissions annotation when creating a root folder via the app platform API', async () => {
      if (!toggle) {
        return;
      }

      const createSpy = jest.fn();
      setupCreateFolderHandler(createSpy);
      const { user } = setupCreateFolder();

      await user.click(screen.getByText(/Create Folder at root/));

      await waitFor(() => expect(createSpy).toHaveBeenCalled());
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            annotations: { [AnnoKeyGrantPermissions]: 'default' },
          }),
        })
      );
    });

    it('sets folder annotation when creating a nested folder via the app platform API', async () => {
      if (!toggle) {
        return;
      }

      const createSpy = jest.fn();
      setupCreateFolderHandler(createSpy);
      const { user } = setupCreateFolder();

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
    });
  });

  describe('useUpdateFolder', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setupUpdateFolderHandler();
    });

    it('updates a folder', async () => {
      const { user } = await setupUpdateFolder(folderA_folderA.item.uid);

      await user.type(screen.getByLabelText('Folder Title'), 'Updated Folder');
      await user.click(screen.getByText('Update Folder'));

      expect(await screen.findByText('Folder updated')).toBeInTheDocument();
    });
  });
});

describe('useUpdateFolder app-platform starred nav update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.foldersAppPlatformAPI = true;
    folderAPIVersionResolver.set('v1beta1');
    setupUpdateFolderHandler();
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
    folderAPIVersionResolver.set('v1beta1');
    dispatchMockFn.mockReset();
  });

  it('dispatches updateDashboardName with the request uid/title and folder URL on rename', async () => {
    const { user } = await setupUpdateFolder(folderA_folderA.item.uid);

    await user.clear(screen.getByLabelText('Folder Title'));
    await user.type(screen.getByLabelText('Folder Title'), 'Updated Folder');
    await user.click(screen.getByText('Update Folder'));

    expect(await screen.findByText('Folder updated')).toBeInTheDocument();

    expect(dispatchMockFn).toHaveBeenCalledWith(
      updateDashboardName({
        id: folderA_folderA.item.uid,
        title: 'Updated Folder',
        url: getStarredFolderURL(folderA_folderA.item.uid),
      })
    );
  });
});

describe('getFolderByUidFacade', () => {
  afterEach(() => {
    config.featureToggles = originalToggles;
    dispatchMockFn.mockReset();
  });

  it('throws the original error with HTTP status when folder API returns 403 and foldersAppPlatformAPI is enabled', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;

    const fetchError = { status: 403, data: { message: 'Forbidden' } };
    dispatchMockFn
      .mockResolvedValueOnce({ error: fetchError, data: undefined })
      .mockResolvedValueOnce({ error: fetchError, data: undefined })
      .mockResolvedValueOnce({ error: fetchError, data: undefined });

    await expect(getFolderByUidFacade('some-folder-uid')).rejects.toHaveProperty('status', 403);
  });

  it('throws the original error with HTTP status when folder API returns 403 and foldersAppPlatformAPI is disabled', async () => {
    config.featureToggles.foldersAppPlatformAPI = false;

    const fetchError = { status: 403, data: { message: 'Forbidden' } };
    dispatchMockFn.mockResolvedValueOnce({ error: fetchError, data: undefined });

    await expect(getFolderByUidFacade('some-folder-uid')).rejects.toHaveProperty('status', 403);
  });

  it('throws a generic error when all responses are undefined and no error is available', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;

    dispatchMockFn
      .mockResolvedValueOnce({ data: undefined })
      .mockResolvedValueOnce({ data: undefined })
      .mockResolvedValueOnce({ data: undefined });

    await expect(getFolderByUidFacade('some-folder-uid')).rejects.toThrow('One of the folder responses is undefined');
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
