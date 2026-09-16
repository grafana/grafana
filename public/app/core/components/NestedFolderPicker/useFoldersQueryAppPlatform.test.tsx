import { QueryStatus } from '@reduxjs/toolkit/query';
import { act, renderHook } from 'test/test-utils';

import { ManagerKind } from 'app/features/apiserver/types';

import { useFoldersQueryAppPlatform } from './useFoldersQueryAppPlatform';
import { getCustomRootFolderItem } from './utils';

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

  it('keeps the root and only folders owned by the selected repository', () => {
    mockSelectorResult = {
      isLoading: false,
      responseByParent: {
        general: {
          status: QueryStatus.fulfilled,
          data: {
            hits: [
              {
                name: 'active-folder',
                title: 'Active folder',
                managedBy: { kind: ManagerKind.Repo, id: 'active-repo' },
              },
              { name: 'other-folder', title: 'Other folder', managedBy: { kind: ManagerKind.Repo, id: 'other-repo' } },
              { name: 'unmanaged-folder', title: 'Unmanaged folder' },
            ],
          },
        },
      },
    };

    const rootFolderItem = getCustomRootFolderItem({ title: 'Active repository', uid: '' });
    const { result } = renderHook(() =>
      useFoldersQueryAppPlatform({
        isBrowsing: true,
        openFolders: {},
        rootFolderUID: 'general',
        rootFolderItem,
        folderFilter: (folder) => folder.managedBy === ManagerKind.Repo && folder.managerId === 'active-repo',
      })
    );

    expect(result.current.items.map(({ item }) => item.uid)).toEqual(['', 'active-folder']);
    expect(result.current.items[0]).toEqual(rootFolderItem);
  });

  it('dispatches an app-platform search request when requestNextPage is called', () => {
    const unsubscribe = jest.fn();
    const subscription = { unsubscribe };
    const dispatch = jest.fn(() => subscription);

    mockDispatchResult = dispatch;
    mockSelectorResult = {
      isLoading: false,
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
});
