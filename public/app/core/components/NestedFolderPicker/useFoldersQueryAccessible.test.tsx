import { renderHook, waitFor } from 'test/test-utils';

import { getAccessibleFolderTree } from 'app/features/folders/api/accessibleFolderTree';

import { useFoldersQueryAccessible } from './useFoldersQueryAccessible';

jest.mock('app/features/folders/api/accessibleFolderTree', () => ({
  getAccessibleFolderTree: jest.fn(),
}));

const tree = [
  { name: 'restricted', title: 'Restricted', access: 'ancestor' as const },
  { name: 'department-a', title: 'Department A', parent: 'restricted', access: 'ancestor' as const },
  { name: 'team-a', title: 'Team A', parent: 'department-a', access: 'full' as const },
];

describe('useFoldersQueryAccessible', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAccessibleFolderTree as jest.Mock).mockResolvedValue(tree);
  });

  it('renders the real hierarchy and disables projected ancestors', async () => {
    const { result } = renderHook(() =>
      useFoldersQueryAccessible({
        isBrowsing: true,
        openFolders: { restricted: true, 'department-a': true },
        permission: 'edit',
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map(({ item, level, disabled }) => ({ uid: item.uid, level, disabled }))).toEqual([
      { uid: '', level: 0, disabled: undefined },
      { uid: 'restricted', level: 1, disabled: undefined },
      { uid: 'department-a', level: 2, disabled: undefined },
      { uid: 'team-a', level: 3, disabled: undefined },
    ]);
    expect(result.current.items.some(({ item }) => item.uid === 'team-b')).toBe(false);
    expect(getAccessibleFolderTree).toHaveBeenCalledWith('edit');
  });

  it('surfaces an error state', async () => {
    (getAccessibleFolderTree as jest.Mock).mockRejectedValue(new Error('tree unavailable'));
    const { result } = renderHook(() =>
      useFoldersQueryAccessible({ isBrowsing: true, openFolders: {}, permission: 'view' })
    );

    await waitFor(() => expect(result.current.error?.message).toBe('tree unavailable'));
    expect(result.current.isLoading).toBe(false);
  });

  it('does not call the endpoint when the rollout toggle is disabled', () => {
    const { result } = renderHook(() =>
      useFoldersQueryAccessible({ isBrowsing: true, openFolders: {}, permission: 'view', enabled: false })
    );

    expect(getAccessibleFolderTree).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
