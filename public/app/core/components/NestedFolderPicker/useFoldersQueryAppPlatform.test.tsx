import { QueryStatus } from '@reduxjs/toolkit/query';
import { act, renderHook } from 'test/test-utils';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';

let mockSelectorResult: unknown;
let mockDispatchResult = jest.fn();
const mockInitiate = jest.fn();
const mockSelect = jest.fn();

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
    },
  },
}));

describe('useFoldersQueryAppPlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatchResult = jest.fn();
  });

  it('returns a list that contains the virtual "Shared with me" folder under the root', () => {
    mockSelectorResult = {
      isLoading: false,
      selectableByParent: {},
      responseByParent: {},
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
      selectableByParent: {},
      responseByParent: {
        general: {
          status: QueryStatus.fulfilled,
          data: {
            hits: [{ name: 'repo-root', title: 'Repo root', folder: 'general', resource: 'folders' }],
          },
        },
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
      selectableByParent: {},
      responseByParent: {},
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
  });

  describe('when showing read only folders', () => {
    const rootResponse = {
      status: QueryStatus.fulfilled,
      data: {
        hits: [
          { name: 'editable', title: 'Editable', folder: 'general', resource: 'folders' },
          { name: 'view-only', title: 'View only', folder: 'general', resource: 'folders' },
        ],
      },
    };

    beforeEach(() => {
      mockDispatchResult = jest.fn(() => ({ unsubscribe: jest.fn() }));
      mockSelect.mockReturnValue(jest.fn());
    });

    it('requests every folder, then checks which of them can be picked', () => {
      mockSelectorResult = { isLoading: false, selectableByParent: {}, responseByParent: {} };

      const { result, rerender } = renderHook(() =>
        useFoldersQueryAppPlatform({ isBrowsing: true, openFolders: {}, permission: 'edit', showReadOnly: true })
      );

      act(() => {
        result.current.requestNextPage(undefined);
      });
      expect(mockInitiate).toHaveBeenCalledWith({ folder: 'general', type: 'folder', permission: undefined });

      mockSelectorResult = { isLoading: false, selectableByParent: {}, responseByParent: { general: rootResponse } };
      rerender();

      expect(mockInitiate).toHaveBeenCalledWith({
        type: 'folder',
        permission: 'edit',
        name: ['editable', 'view-only'],
        limit: 2,
      });
    });

    it('holds the children back until it knows which can be picked', () => {
      mockSelectorResult = { isLoading: false, selectableByParent: {}, responseByParent: { general: rootResponse } };

      const { result } = renderHook(() =>
        useFoldersQueryAppPlatform({ isBrowsing: true, openFolders: {}, permission: 'edit', showReadOnly: true })
      );

      expect(result.current.items.find((treeItem) => treeItem.item.uid === 'editable')).toBeUndefined();
      expect(result.current.items.some((treeItem) => treeItem.item.kind === 'ui')).toBe(true);
    });

    it('marks the folders that cannot be picked as disabled and read only', () => {
      mockSelectorResult = {
        isLoading: false,
        selectableByParent: { general: new Set(['editable']) },
        responseByParent: { general: rootResponse },
      };

      const { result } = renderHook(() =>
        useFoldersQueryAppPlatform({ isBrowsing: true, openFolders: {}, permission: 'edit', showReadOnly: true })
      );

      const editable = result.current.items.find((treeItem) => treeItem.item.uid === 'editable');
      const viewOnly = result.current.items.find((treeItem) => treeItem.item.uid === 'view-only');
      expect(editable).toMatchObject({ disabled: false });
      expect(editable?.readOnly).toBeUndefined();
      expect(viewOnly).toMatchObject({ disabled: true, readOnly: true });
    });
  });
});
