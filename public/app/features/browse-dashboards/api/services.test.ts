import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { config, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, apiFoldersHandlers } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { listDashboards, listFolders } from './services';

jest.mock('app/core/services/context_srv', () => {
  const contextSrvModule = jest.requireActual('app/core/services/context_srv');
  return {
    ...contextSrvModule,
    contextSrv: {
      ...contextSrvModule.contextSrv,
      hasPermission: jest.fn(),
    },
  };
});

setBackendSrv(backendSrv);
setupMockServer();

const dashboardHits = Array.from({ length: 7 }, (_, index) => ({
  resource: 'dashboards',
  name: `dashboard-${index + 1}`,
  title: `Dashboard ${index + 1}`,
  folder: 'abc-123',
  field: {},
}));
const folderHits: DashboardHit[] = [
  { resource: 'folders', name: 'folder-1', title: 'Folder 1', folder: 'parent-uid', field: {} },
  {
    resource: 'folders',
    name: 'folder-2',
    title: 'Folder 2',
    folder: 'parent-uid',
    field: {},
  },
  { resource: 'folders', name: 'root-folder-1', title: 'Root Folder 1', field: {} },
  { resource: 'folders', name: 'root-folder-2', title: 'Root Folder 2', field: {} },
];

const allHits = [...dashboardHits, ...folderHits];

describe('browse-dashboards services', () => {
  describe('listDashboards', () => {
    const PAGE_SIZE = 2;

    it.each([
      { page: undefined, expectedTitles: ['Dashboard 1', 'Dashboard 2'] },
      { page: 1, expectedTitles: ['Dashboard 1', 'Dashboard 2'] },
      { page: 2, expectedTitles: ['Dashboard 3', 'Dashboard 4'] },
      { page: 4, expectedTitles: ['Dashboard 7'] },
    ])('returns the correct dashboards for page $page', async ({ page, expectedTitles }) => {
      server.use(getCustomSearchHandler(allHits));
      const result = await listDashboards('abc-123', page, PAGE_SIZE);

      expect(result.map((item) => item.title)).toEqual(expectedTitles);
    });
  });

  describe('listFolders', () => {
    const PAGE_SIZE = 2;
    const mockContextSrv = contextSrv as jest.Mocked<typeof contextSrv>;

    beforeEach(() => {
      jest.clearAllMocks();
      mockContextSrv.hasPermission = jest.fn().mockReturnValue(true);
      config.featureToggles.foldersAppPlatformAPI = false;
      config.sharedWithMeFolderUID = 'sharedwithme';
    });

    describe('old API (foldersAppPlatformAPI = false)', () => {
      beforeEach(() => {
        config.featureToggles.foldersAppPlatformAPI = false;
      });

      it('returns folders in correct format', async () => {
        const result = await listFolders(undefined, 'Parent Title', 1, PAGE_SIZE);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          kind: 'folder',
          uid: expect.any(String),
          title: expect.any(String),
          parentTitle: 'Parent Title',
          parentUID: undefined,
          managedBy: undefined,
        });
      });

      it('handles pagination correctly', async () => {
        const result1 = await listFolders(undefined, undefined, 1, 4);
        const result2 = await listFolders(undefined, undefined, 2, 2);

        expect(result1).toHaveLength(4);
        expect(result2).toHaveLength(2);
        expect(result1[2]).toMatchObject(result2[0]);
        expect(result1[3]).toMatchObject(result2[1]);
      });

      it('does not add shared with me folder (handled by backend)', async () => {
        const result = await listFolders(undefined, undefined, 1, 1);

        expect(result).toHaveLength(1);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });
    });

    describe('new API (foldersAppPlatformAPI = true)', () => {
      beforeEach(() => {
        config.featureToggles.foldersAppPlatformAPI = true;
      });

      it('returns the correct folders for the requested page', async () => {
        server.use(getCustomSearchHandler(allHits));
        const result = await listFolders('parent-uid', 'Parent Title', 1, 1);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Folder 1');
      });

      it('returns folders in correct format', async () => {
        server.use(getCustomSearchHandler(allHits));
        const result = await listFolders('parent-uid', 'Parent Title', 1, PAGE_SIZE);

        // Should have 2 folders (no shared with me when parentUID is provided)
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          kind: 'folder',
          uid: 'folder-1',
          title: 'Folder 1',
          parentTitle: 'Parent Title',
          parentUID: 'parent-uid',
        });
        expect(result[1]).toMatchObject({
          kind: 'folder',
          uid: 'folder-2',
          title: 'Folder 2',
          parentTitle: 'Parent Title',
          parentUID: 'parent-uid',
        });
      });

      it('adds shared with me folder at root level', async () => {
        server.use(getCustomSearchHandler(allHits));
        const result = await listFolders(undefined, undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
          kind: 'folder',
          uid: 'sharedwithme',
          title: 'Shared with me',
          url: undefined, // shared with me has no URL
        });
      });

      it('does not add shared with me folder on subsequent pages', async () => {
        const result = await listFolders(undefined, undefined, 2, PAGE_SIZE);

        expect(result).toHaveLength(2);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });

      it('does not add shared with me folder when parentUID is provided', async () => {
        server.use(getCustomSearchHandler(allHits));
        const result = await listFolders('parent-uid', undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(2);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });

      it('does not add shared with me folder when config.sharedWithMeFolderUID is not set', async () => {
        server.use(getCustomSearchHandler(allHits));
        config.sharedWithMeFolderUID = undefined;

        const result = await listFolders(undefined, undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(2);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });
    });

    describe('permissions', () => {
      it('returns empty array when user does not have FoldersRead permission', async () => {
        mockContextSrv.hasPermission = jest.fn().mockReturnValue(false);

        const result = await listFolders();

        expect(result).toEqual([]);
      });
    });

    describe('URL generation', () => {
      it('sets URL to undefined for shared with me folder', async () => {
        server.use(
          apiFoldersHandlers.minimalCustomFoldersHandler([
            { uid: 'sharedwithme', title: 'Shared with me' },
            { uid: 'regular-folder', title: 'Regular folder' },
          ])
        );
        const result = await listFolders();

        const sharedFolder = result.find((f) => f.uid === 'sharedwithme');
        const regularFolder = result.find((f) => f.uid === 'regular-folder');

        expect(sharedFolder?.url).toBeUndefined();
        expect(regularFolder?.url).toBeDefined();
      });
    });
  });
});
