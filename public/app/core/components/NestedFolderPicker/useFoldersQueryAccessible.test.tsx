import { renderHook, waitFor } from 'test/test-utils';

import { getFolderNavigationTree } from 'app/features/folders/api/accessibleFolderTree';

import { useFoldersQueryAccessible } from './useFoldersQueryAccessible';

jest.mock('app/features/folders/api/accessibleFolderTree', () => ({
  buildFolderNavigationIndex: jest.requireActual('app/features/folders/api/accessibleFolderTree')
    .buildFolderNavigationIndex,
  getFolderNavigationTree: jest.fn(),
}));

const tree = [
  {
    uid: 'sharedwithme',
    title: 'Shared with me',
    kind: 'virtual' as const,
    access: 'navigation' as const,
    selectable: false,
  },
  { uid: 'restricted', title: 'Restricted', kind: 'folder' as const, access: 'ancestor' as const, selectable: false },
  {
    uid: 'department-a',
    title: 'Department A',
    kind: 'folder' as const,
    navigationParentUid: 'restricted',
    access: 'ancestor' as const,
    selectable: false,
  },
  {
    uid: 'team-a',
    title: 'Team A',
    kind: 'folder' as const,
    navigationParentUid: 'department-a',
    access: 'full' as const,
    selectable: true,
  },
];

describe('useFoldersQueryAccessible', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getFolderNavigationTree as jest.Mock).mockResolvedValue(tree);
  });

  it('renders the real hierarchy and disables projected ancestors', async () => {
    const { result } = renderHook(() =>
      useFoldersQueryAccessible({
        isBrowsing: true,
        openFolders: { restricted: true, 'department-a': true },
        purpose: 'dashboard-create',
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map(({ item, level, disabled }) => ({ uid: item.uid, level, disabled }))).toEqual([
      { uid: '', level: 0, disabled: undefined },
      { uid: 'sharedwithme', level: 1, disabled: undefined },
      { uid: 'restricted', level: 1, disabled: undefined },
      { uid: 'department-a', level: 2, disabled: undefined },
      { uid: 'team-a', level: 3, disabled: undefined },
    ]);
    expect(result.current.items.some(({ item }) => item.uid === 'team-b')).toBe(false);
    expect(getFolderNavigationTree).toHaveBeenCalledWith('dashboard-create');
  });

  it('surfaces an error state', async () => {
    (getFolderNavigationTree as jest.Mock).mockRejectedValue(new Error('tree unavailable'));
    const { result } = renderHook(() =>
      useFoldersQueryAccessible({ isBrowsing: true, openFolders: {}, purpose: 'browse' })
    );

    await waitFor(() => expect(result.current.error?.message).toBe('tree unavailable'));
    expect(result.current.isLoading).toBe(false);
  });
});
