import { renderHook, getWrapper, waitFor, screen } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  useDeleteFoldersMutation as useDeleteFoldersMutationLegacy,
  useMoveFoldersMutation as useMoveFoldersMutationLegacy,
} from 'app/features/browse-dashboards/api/browseDashboardsAPI';

import { AnnoKeyFolder } from '../../../../features/apiserver/types';

import {
  useGetFolderQueryFacade,
  useDeleteMultipleFoldersMutationFacade,
  useMoveMultipleFoldersMutationFacade,
} from './hooks';
import { setupCreateFolder, setupUpdateFolder } from './test-utils';

import { useDeleteFolderMutation, useUpdateFolderMutation } from './index';

// Mocks for the hooks used inside useGetFolderQueryFacade
jest.mock('./index', () => ({
  ...jest.requireActual('./index'),
  useDeleteFolderMutation: jest.fn(),
  useUpdateFolderMutation: jest.fn(),
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
    useDispatch: () => dispatchMockFn,
  };
});

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

const originalToggles = { ...config.featureToggles };
afterAll(() => {
  // Restore the original feature toggle value changed during tests
  config.featureToggles = originalToggles;
});

describe('useGetFolderQueryFacade', () => {
  const originalAppSubUrl = String(config.appSubUrl);

  beforeEach(() => {
    config.appSubUrl = '/grafana';
  });

  afterEach(() => {
    config.featureToggles = originalToggles;
    config.appSubUrl = originalAppSubUrl;
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
    const folderUIDs = ['uid1', 'uid2'];
    const deleteFolders = useDeleteMultipleFoldersMutationFacade();
    await deleteFolders({ folderUIDs });

    // Should call deleteFolder for each UID
    expect(mockDeleteFolder).toHaveBeenCalledTimes(folderUIDs.length);
    expect(mockDeleteFolder).toHaveBeenCalledWith({ name: 'uid1' });
    expect(mockDeleteFolder).toHaveBeenCalledWith({ name: 'uid2' });

    // Should publish success alert
    expect(publishMockFn).toHaveBeenCalledWith({
      type: AppEvents.alertSuccess.name,
      payload: ['Folder deleted'],
    });

    // Should dispatch refreshParents
    expect(dispatchMockFn).toHaveBeenCalled();
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
  const mockUpdateFolder = jest.fn(() => ({ error: undefined }));
  const mockMoveFolders = jest.fn(() => ({ error: undefined }));

  beforeEach(() => {
    jest.clearAllMocks();
    (useUpdateFolderMutation as jest.Mock).mockReturnValue([mockUpdateFolder]);
    (useMoveFoldersMutationLegacy as jest.Mock).mockReturnValue([mockMoveFolders]);
  });

  it('moves multiple folders and publishes success alert', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;
    const folderUIDs = ['uid1', 'uid2'];
    const [moveFolders] = useMoveMultipleFoldersMutationFacade();
    await moveFolders({ folderUIDs, destinationUID: 'uid3' });

    // Should call deleteFolder for each UID
    expect(mockUpdateFolder).toHaveBeenCalledTimes(folderUIDs.length);
    expect(mockUpdateFolder).toHaveBeenCalledWith({
      name: 'uid1',
      patch: { metadata: { annotations: { [AnnoKeyFolder]: 'uid3' } } },
    });
    expect(mockUpdateFolder).toHaveBeenCalledWith({
      name: 'uid2',
      patch: { metadata: { annotations: { [AnnoKeyFolder]: 'uid3' } } },
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
    const [moveFolders] = useMoveMultipleFoldersMutationFacade();
    await moveFolders({ folderUIDs, destinationUID: 'uid3' });

    // Should call deleteFolder for each UID
    expect(mockMoveFolders).toHaveBeenCalledTimes(1);
    expect(mockMoveFolders).toHaveBeenCalledWith({ folderUIDs, destinationUID: 'uid3' });
  });
});

describe.each([
  // app platform
  true,
  // legacy
  // false,
])('folderAppPlatformAPI toggle set to: %s', (toggle) => {
  beforeEach(() => {
    config.featureToggles.foldersAppPlatformAPI = toggle;
  });
  afterEach(() => {
    config.featureToggles = originalToggles;
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
  });

  describe('useUpdateFolder', () => {
    it('updates a folder', async () => {
      const { user } = await setupUpdateFolder(folderA_folderA.item.uid);

      await user.type(screen.getByLabelText('Folder Title'), 'Updated Folder');
      await user.click(screen.getByText('Update Folder'));

      expect(await screen.findByText('Folder updated')).toBeInTheDocument();
    });
  });
});
