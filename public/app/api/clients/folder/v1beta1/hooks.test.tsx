import { render, renderHook, getWrapper, waitFor, screen } from 'test/test-utils';

import { config, setAppEvents, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { useGetFolderQueryFacade, useDeleteMultipleFoldersMutationFacade } from './hooks';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import appEvents from 'app/core/app_events';

setBackendSrv(backendSrv);
setupMockServer();
setAppEvents(appEvents);

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
    expect(result.current.isLoading).toBe(false);
  });
  return result;
};

const originalToggles = { ...config.featureToggles };
const originalAppSubUrl = String(config.appSubUrl);

describe('useGetFolderQueryFacade', () => {
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
      id: 1,
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

fdescribe('useDeleteMultipleFoldersMutationFacade', () => {
  const dispatchMock = jest.fn();
  const publishMock = jest.fn();
  const mockDeleteFolder = jest.fn(() => ({ error: undefined }));
  const mockDeleteFolderLegacy = jest.fn(() => ({ error: undefined }));

  const oldToggleValue = config.featureToggles.foldersAppPlatformAPI;

  afterAll(() => {
    config.featureToggles.foldersAppPlatformAPI = oldToggleValue;
  });

  it('deletes multiple folders and publishes success alert', async () => {
    config.featureToggles.foldersAppPlatformAPI = true;

    const folderUIDs = ['uid1', 'uid2'];
    const { user } = render(<TestDeleteComponent />);
    await user.click(screen.getByText('Delete'));

    expect(await screen.findByText('Folder deleted')).toBeInTheDocument();

    // Should call deleteFolder for each UID
    expect(mockDeleteFolder).toHaveBeenCalledTimes(folderUIDs.length);
    expect(mockDeleteFolder).toHaveBeenCalledWith({ name: 'uid1' });
    expect(mockDeleteFolder).toHaveBeenCalledWith({ name: 'uid2' });

    // Should publish success alert
    // expect(publishMock).toHaveBeenCalledWith({
    //   type: AppEvents.alertSuccess.name,
    //   payload: ['Folder deleted'],
    // });

    // Should dispatch refreshParents
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('uses legacy call when flag is false', async () => {
    config.featureToggles.foldersAppPlatformAPI = false;
    const { user } = render(<TestDeleteComponent />);
    await user.click(screen.getByText('Delete'));

    // Should call deleteFolder for each UID
    expect(mockDeleteFolderLegacy).toHaveBeenCalledTimes(1);
    // expect(mockDeleteFolderLegacy).toHaveBeenCalledWith({ folderUIDs §});
  });
});

const TestDeleteComponent = () => {
  const deleteFolders = useDeleteMultipleFoldersMutationFacade();
  const { data: folder1 } = useGetFolderQueryFacade('uid1');
  const { data: folder2 } = useGetFolderQueryFacade('uid2');
  return (
    <>
      {/* Include so we can assert on the presence of success/error toasts */}
      <AppNotificationList />
      <button onClick={() => deleteFolders({ folderUIDs: ['uid1', 'uid2'] })}>Delete</button>
      {folder1 && <div key={folder1.uid}>{folder1.title}</div>}
      {folder2 && <div key={folder2.uid}>{folder2.title}</div>}
    </>
  );
};
