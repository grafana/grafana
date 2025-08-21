import { renderHook, getWrapper, waitFor } from 'test/test-utils';

import { config, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { useGetFolderQueryFacade } from './hooks';

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
