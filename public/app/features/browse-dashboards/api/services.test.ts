import { DataFrame, DataFrameView, FieldType } from '@grafana/data';
import { BackendSrv, config, getBackendSrv, setBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult, QueryResponse } from 'app/features/search/service/types';

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

describe('browse-dashboards services', () => {
  describe('listDashboards', () => {
    const searchData: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: [] },
        { name: 'name', type: FieldType.string, config: {}, values: [] },
        { name: 'uid', type: FieldType.string, config: {}, values: [] },
        { name: 'url', type: FieldType.string, config: {}, values: [] },
        { name: 'tags', type: FieldType.other, config: {}, values: [] },
        { name: 'location', type: FieldType.string, config: {}, values: [] },
      ],
      length: 0,
    };

    const mockSearchResult: QueryResponse = {
      isItemLoaded: jest.fn(),
      loadMoreItems: jest.fn(),
      totalRows: searchData.length,
      view: new DataFrameView<DashboardQueryResult>(searchData),
    };

    const searchMock = jest.spyOn(getGrafanaSearcher(), 'search');
    searchMock.mockResolvedValue(mockSearchResult);

    const PAGE_SIZE = 50;

    it.each([
      { page: undefined, expectedFrom: 0 },
      { page: 1, expectedFrom: 0 },
      { page: 2, expectedFrom: 50 },
      { page: 4, expectedFrom: 150 },
    ])('skips first $expectedFrom when listing page $page', async ({ page, expectedFrom }) => {
      await listDashboards('abc-123', page, PAGE_SIZE);

      expect(searchMock).toHaveBeenCalledWith({
        kind: ['dashboard'],
        query: '*',
        location: 'abc-123',
        from: expectedFrom,
        limit: PAGE_SIZE,
        offset: expectedFrom,
      });
    });
  });

  describe('listFolders', () => {
    const PAGE_SIZE = 50;
    const mockContextSrv = contextSrv as jest.Mocked<typeof contextSrv>;
    let backendGetMock: jest.Mock;
    let originalBackendSrv: BackendSrv;

    beforeAll(() => {
      originalBackendSrv = getBackendSrv();
    });

    afterAll(() => {
      setBackendSrv(originalBackendSrv);
    });

    beforeEach(() => {
      jest.clearAllMocks();
      backendGetMock = jest.fn();
      setBackendSrv({ ...originalBackendSrv, get: backendGetMock });
      mockContextSrv.hasPermission = jest.fn().mockReturnValue(true);
      config.featureToggles.foldersAppPlatformAPI = false;
      config.sharedWithMeFolderUID = 'sharedwithme';
    });

    describe('old API (foldersAppPlatformAPI = false)', () => {
      beforeEach(() => {
        config.featureToggles.foldersAppPlatformAPI = false;
      });

      it('calls the old /api/folders endpoint', async () => {
        const mockFolders = [
          { uid: 'folder-1', title: 'Folder 1' },
          { uid: 'folder-2', title: 'Folder 2' },
        ];
        backendGetMock.mockResolvedValue(mockFolders);

        await listFolders('parent-uid', 'Parent Title', 1, PAGE_SIZE);

        expect(backendGetMock).toHaveBeenCalledWith('/api/folders', {
          parentUid: 'parent-uid',
          page: 1,
          limit: PAGE_SIZE,
        });
      });

      it('returns folders in correct format', async () => {
        const mockFolders = [
          { uid: 'folder-1', title: 'Folder 1', managedBy: 'terraform' },
          { uid: 'folder-2', title: 'Folder 2' },
        ];
        backendGetMock.mockResolvedValue(mockFolders);

        const result = await listFolders('parent-uid', 'Parent Title', 1, PAGE_SIZE);

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          kind: 'folder',
          uid: 'folder-1',
          title: 'Folder 1',
          parentTitle: 'Parent Title',
          parentUID: 'parent-uid',
          managedBy: 'terraform',
        });
      });

      it('handles pagination correctly', async () => {
        backendGetMock.mockResolvedValue([]);

        await listFolders(undefined, undefined, 3, PAGE_SIZE);

        expect(backendGetMock).toHaveBeenCalledWith('/api/folders', {
          parentUid: undefined,
          page: 3,
          limit: PAGE_SIZE,
        });
      });

      it('does not add shared with me folder (handled by backend)', async () => {
        const mockFolders = [{ uid: 'folder-1', title: 'Folder 1' }];
        backendGetMock.mockResolvedValue(mockFolders);

        const result = await listFolders(undefined, undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(1);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });
    });

    describe('new API (foldersAppPlatformAPI = true)', () => {
      const createSearchData = (folders: Array<{ uid: string; name: string; managedBy?: string }>) => {
        const searchData: DataFrame = {
          fields: [
            { name: 'kind', type: FieldType.string, config: {}, values: folders.map(() => 'folder') },
            { name: 'name', type: FieldType.string, config: {}, values: folders.map((f) => f.name) },
            { name: 'uid', type: FieldType.string, config: {}, values: folders.map((f) => f.uid) },
            { name: 'url', type: FieldType.string, config: {}, values: folders.map(() => '') },
            { name: 'tags', type: FieldType.other, config: {}, values: folders.map(() => []) },
            { name: 'location', type: FieldType.string, config: {}, values: folders.map(() => '') },
            { name: 'managedBy', type: FieldType.string, config: {}, values: folders.map((f) => f.managedBy || '') },
          ],
          length: folders.length,
        };

        return {
          isItemLoaded: jest.fn(),
          loadMoreItems: jest.fn(),
          totalRows: folders.length,
          view: new DataFrameView<DashboardQueryResult>(searchData),
        };
      };

      const searchMock = jest.spyOn(getGrafanaSearcher(), 'search');

      beforeEach(() => {
        config.featureToggles.foldersAppPlatformAPI = true;
      });

      it('calls the search API with correct parameters', async () => {
        searchMock.mockResolvedValue(createSearchData([]));

        await listFolders('parent-uid', 'Parent Title', 1, PAGE_SIZE);

        expect(searchMock).toHaveBeenCalledWith({
          kind: ['folder'],
          location: 'parent-uid',
          from: 0,
          limit: PAGE_SIZE,
          offset: 0,
        });
      });

      it('uses "general" location when parentUID is not provided', async () => {
        searchMock.mockResolvedValue(createSearchData([]));

        await listFolders(undefined, undefined, 1, PAGE_SIZE);

        expect(searchMock).toHaveBeenCalledWith({
          kind: ['folder'],
          location: 'general',
          from: 0,
          limit: PAGE_SIZE,
          offset: 0,
        });
      });

      it('returns folders in correct format', async () => {
        const mockFolders = [
          { uid: 'folder-1', name: 'Folder 1', managedBy: 'terraform' },
          { uid: 'folder-2', name: 'Folder 2' },
        ];
        searchMock.mockResolvedValue(createSearchData(mockFolders));

        const result = await listFolders('parent-uid', 'Parent Title', 1, PAGE_SIZE);

        // Should have 2 folders (no shared with me when parentUID is provided)
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          kind: 'folder',
          uid: 'folder-1',
          title: 'Folder 1',
          parentTitle: 'Parent Title',
          parentUID: 'parent-uid',
          managedBy: 'terraform',
        });
      });

      it('adds shared with me folder at root level', async () => {
        const mockFolders = [
          { uid: 'folder-1', name: 'Folder 1' },
          { uid: 'folder-2', name: 'Folder 2' },
        ];
        searchMock.mockResolvedValue(createSearchData(mockFolders));

        const result = await listFolders(undefined, undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
          kind: 'folder',
          uid: 'sharedwithme',
          title: 'Shared with me',
          url: undefined, // shared with me has no URL
        });
      });

      it('does not add shared with me folder when parentUID is provided', async () => {
        const mockFolders = [{ uid: 'folder-1', name: 'Folder 1' }];
        searchMock.mockResolvedValue(createSearchData(mockFolders));

        const result = await listFolders('parent-uid', undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(1);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });

      it('does not add shared with me folder when config.sharedWithMeFolderUID is not set', async () => {
        config.sharedWithMeFolderUID = undefined;
        const mockFolders = [{ uid: 'folder-1', name: 'Folder 1' }];
        searchMock.mockResolvedValue(createSearchData(mockFolders));

        const result = await listFolders(undefined, undefined, 1, PAGE_SIZE);

        expect(result).toHaveLength(1);
        expect(result.find((f) => f.uid === 'sharedwithme')).toBeUndefined();
      });

      it('handles pagination correctly', async () => {
        searchMock.mockResolvedValue(createSearchData([]));

        await listFolders(undefined, undefined, 3, PAGE_SIZE);

        expect(searchMock).toHaveBeenCalledWith({
          kind: ['folder'],
          location: 'general',
          from: 100, // (3-1) * 50
          limit: PAGE_SIZE,
          offset: 100,
        });
      });

      it.each([
        { page: 1, expectedFrom: 0 },
        { page: 2, expectedFrom: 50 },
        { page: 4, expectedFrom: 150 },
      ])('calculates correct offset for page $page', async ({ page, expectedFrom }) => {
        searchMock.mockResolvedValue(createSearchData([]));

        await listFolders('parent-uid', undefined, page, PAGE_SIZE);

        expect(searchMock).toHaveBeenCalledWith({
          kind: ['folder'],
          location: 'parent-uid',
          from: expectedFrom,
          limit: PAGE_SIZE,
          offset: expectedFrom,
        });
      });
    });

    describe('permissions', () => {
      it('returns empty array when user does not have FoldersRead permission', async () => {
        mockContextSrv.hasPermission = jest.fn().mockReturnValue(false);
        backendGetMock.mockResolvedValue([]);

        const result = await listFolders();

        expect(result).toEqual([]);
        expect(backendGetMock).not.toHaveBeenCalled();
      });
    });

    describe('URL generation', () => {
      beforeEach(() => {
        backendGetMock.mockResolvedValue([
          { uid: 'regular-folder', title: 'Regular Folder' },
          { uid: 'sharedwithme', title: 'Shared with me' },
        ]);
      });

      it('sets URL to undefined for shared with me folder', async () => {
        const result = await listFolders();

        const sharedFolder = result.find((f) => f.uid === 'sharedwithme');
        const regularFolder = result.find((f) => f.uid === 'regular-folder');

        expect(sharedFolder?.url).toBeUndefined();
        expect(regularFolder?.url).toBeDefined();
      });
    });
  });
});
