import { QueryStatus } from '@reduxjs/toolkit/query';
import { act, renderHook } from 'test/test-utils';

import { PAGE_SIZE } from '../../../features/browse-dashboards/api/constants';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';

let mockSelectorResult: unknown;
let mockDispatchResult = jest.fn();
const mockInitiate = jest.fn();
const mockSelect = jest.fn();
const mockPageInitiate = jest.fn();
const mockPageSelect = jest.fn();

jest.mock('app/types/store', () => ({
  ...jest.requireActual('app/types/store'),
  useDispatch: jest.fn(() => mockDispatchResult),
  useSelector: jest.fn(() => mockSelectorResult),
}));

jest.mock('app/api/clients/dashboard/v0alpha1', () => ({
  dashboardAPIv0alpha1: {
    endpoints: {
      searchDashboardsAndFolders: {
        initiate: (...args: unknown[]) => mockInitiate(...args),
        select: (...args: unknown[]) => mockSelect(...args),
      },
      searchFolderChildrenPage: {
        initiate: (...args: unknown[]) => mockPageInitiate(...args),
        select: (...args: unknown[]) => mockPageSelect(...args),
      },
    },
  },
}));

const folderHits = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    name: `${prefix}-${i}`,
    title: `${prefix} ${String(i).padStart(2, '0')}`,
    folder: 'general',
    resource: 'folders',
  }));

const rootPage = (offset: number, hits: ReturnType<typeof folderHits>) => ({
  status: QueryStatus.fulfilled,
  originalArgs: { folder: 'general', limit: PAGE_SIZE, offset },
  data: { hits },
});

describe('useFoldersQueryAppPlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatchResult = jest.fn();
  });

  it('returns a list that contains the virtual "Shared with me" folder under the root', () => {
    mockSelectorResult = {
      isLoading: false,
      selectableByKey: {},
      pagesByParent: {},
    };

    const { result } = renderHook(() =>
      useFoldersQueryAppPlatform({
        isBrowsing: true,
        openFolders: {},
        permission: 'edit',
      })
    );

    // Root "Dashboards" item is injected by the hook.
    expect(result.current.items[0].item.kind).toBe('folder');
    expect(result.current.items[0].item.uid).toBe('');

    const sharedWithMe = result.current.items.find((t) => t.item.kind === 'folder' && t.item.uid === 'sharedwithme');
    expect(sharedWithMe).toBeDefined();
    expect(sharedWithMe?.level).toBe(1);
  });

  it('normalizes the canonical root folder sentinel', () => {
    mockSelectorResult = {
      isLoading: false,
      selectableByKey: {},
      pagesByParent: {
        general: [
          {
            status: QueryStatus.fulfilled,
            data: {
              hits: [{ name: 'repo-root', title: 'Repo root', folder: 'general', resource: 'folders' }],
            },
          },
        ],
      },
    };

    const { result } = renderHook(() =>
      useFoldersQueryAppPlatform({
        isBrowsing: true,
        openFolders: {},
        permission: 'edit',
      })
    );

    const repositoryRoot = result.current.items.find((treeItem) => treeItem.item.uid === 'repo-root');
    expect(repositoryRoot?.item).toMatchObject({ parentUID: undefined });
  });

  it('dispatches an app-platform search request when requestNextPage is called', () => {
    const unsubscribe = jest.fn();
    const subscription = { unsubscribe };
    const dispatch = jest.fn(() => subscription);

    mockDispatchResult = dispatch;
    mockSelectorResult = {
      isLoading: false,
      selectableByKey: {},
      pagesByParent: {},
    };

    mockInitiate.mockReturnValue(subscription);
    mockSelect.mockReturnValue(jest.fn());

    const { result } = renderHook(() =>
      useFoldersQueryAppPlatform({
        isBrowsing: true,
        openFolders: {},
        permission: 'edit',
      })
    );

    act(() => {
      result.current.requestNextPage(undefined);
    });

    expect(mockInitiate).toHaveBeenCalledWith({ folder: 'general', type: 'folder', permission: 'edit' });
    expect(dispatch).toHaveBeenCalledWith(subscription);
    expect(mockSelect).toHaveBeenCalledWith({ folder: 'general', type: 'folder', permission: 'edit' });
    expect(mockPageInitiate).not.toHaveBeenCalled();
  });

  describe('when showing read only folders', () => {
    const rootHits = [
      { name: 'editable', title: 'Editable', folder: 'general', resource: 'folders' },
      { name: 'view-only', title: 'View only', folder: 'general', resource: 'folders' },
    ];

    const renderReadOnlyHook = () =>
      renderHook(() =>
        useFoldersQueryAppPlatform({ isBrowsing: true, openFolders: {}, permission: 'edit', showReadOnly: true })
      );

    beforeEach(() => {
      mockDispatchResult = jest.fn(() => ({ unsubscribe: jest.fn() }));
      mockSelect.mockReturnValue(jest.fn());
      mockPageSelect.mockReturnValue(jest.fn());
    });

    it('requests the first page of every folder, then checks which of them can be picked', () => {
      mockSelectorResult = { isLoading: false, selectableByKey: {}, pagesByParent: {} };

      const { result, rerender } = renderReadOnlyHook();

      act(() => {
        result.current.requestNextPage(undefined);
      });
      expect(mockPageInitiate).toHaveBeenCalledWith({ folder: 'general', limit: PAGE_SIZE, offset: 0 });

      mockSelectorResult = {
        isLoading: false,
        selectableByKey: {},
        pagesByParent: { general: [rootPage(0, rootHits)] },
      };
      rerender();

      expect(mockInitiate).toHaveBeenCalledWith({
        type: 'folder',
        permission: 'create',
        name: ['editable', 'view-only'],
        limit: 2,
      });
    });

    it('holds the children back until it knows which can be picked', () => {
      mockSelectorResult = {
        isLoading: false,
        selectableByKey: {},
        pagesByParent: { general: [rootPage(0, rootHits)] },
      };

      const { result } = renderReadOnlyHook();

      expect(result.current.items.find((treeItem) => treeItem.item.uid === 'editable')).toBeUndefined();
      expect(result.current.items.some((treeItem) => treeItem.item.kind === 'ui')).toBe(true);
    });

    it('marks the folders that cannot be picked as disabled and read only', () => {
      mockSelectorResult = {
        isLoading: false,
        selectableByKey: { 'general@0': new Set(['editable']) },
        pagesByParent: { general: [rootPage(0, rootHits)] },
      };

      const { result } = renderReadOnlyHook();

      const editable = result.current.items.find((treeItem) => treeItem.item.uid === 'editable');
      const viewOnly = result.current.items.find((treeItem) => treeItem.item.uid === 'view-only');
      expect(editable).toMatchObject({ disabled: false });
      expect(editable?.readOnly).toBeUndefined();
      expect(viewOnly).toMatchObject({ disabled: true, readOnly: true });
      expect(result.current.items.some((treeItem) => treeItem.item.kind === 'ui')).toBe(false);
    });

    it('loads the next page after a full one', () => {
      const firstPage = folderHits('first', PAGE_SIZE);
      mockSelectorResult = {
        isLoading: false,
        selectableByKey: { 'general@0': new Set(firstPage.map((hit) => hit.name)) },
        pagesByParent: { general: [rootPage(0, firstPage)] },
      };

      const { result } = renderReadOnlyHook();

      expect(result.current.items.filter((treeItem) => treeItem.item.uid.startsWith('first-'))).toHaveLength(PAGE_SIZE);
      expect(result.current.items.some((treeItem) => treeItem.item.kind === 'ui')).toBe(true);

      act(() => {
        result.current.requestNextPage(undefined);
      });
      expect(mockPageInitiate).toHaveBeenCalledWith({ folder: 'general', limit: PAGE_SIZE, offset: PAGE_SIZE });
    });

    it('stops loading after a short page', () => {
      mockSelectorResult = {
        isLoading: false,
        selectableByKey: { 'general@0': new Set(['editable']) },
        pagesByParent: { general: [rootPage(0, rootHits)] },
      };

      const { result } = renderReadOnlyHook();

      act(() => {
        result.current.requestNextPage(undefined);
      });
      expect(mockPageInitiate).not.toHaveBeenCalled();
    });

    it('shows a later page only once its own check is done', () => {
      const firstPage = folderHits('first', PAGE_SIZE);
      const secondPage = folderHits('second', 2);
      mockSelectorResult = {
        isLoading: false,
        selectableByKey: { 'general@0': new Set(firstPage.map((hit) => hit.name)) },
        pagesByParent: { general: [rootPage(0, firstPage), rootPage(PAGE_SIZE, secondPage)] },
      };

      const { result, rerender } = renderReadOnlyHook();

      expect(result.current.items.some((treeItem) => treeItem.item.uid === 'first-0')).toBe(true);
      expect(result.current.items.some((treeItem) => treeItem.item.uid === 'second-0')).toBe(false);
      expect(mockInitiate).toHaveBeenCalledWith({
        type: 'folder',
        permission: 'create',
        name: ['second-0', 'second-1'],
        limit: 2,
      });

      mockSelectorResult = {
        isLoading: false,
        selectableByKey: {
          'general@0': new Set(firstPage.map((hit) => hit.name)),
          [`general@${PAGE_SIZE}`]: new Set(['second-0']),
        },
        pagesByParent: { general: [rootPage(0, firstPage), rootPage(PAGE_SIZE, secondPage)] },
      };
      rerender();

      expect(result.current.items.find((treeItem) => treeItem.item.uid === 'second-0')).toMatchObject({
        disabled: false,
      });
      expect(result.current.items.find((treeItem) => treeItem.item.uid === 'second-1')).toMatchObject({
        disabled: true,
        readOnly: true,
      });
      expect(result.current.items.some((treeItem) => treeItem.item.kind === 'ui')).toBe(false);
    });
  });
});
