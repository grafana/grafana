import { deletedDashboardsCache, deletedFoldersState } from './deletedDashboardsCache';

describe('deleted dashboard trash state', () => {
  beforeEach(() => {
    deletedDashboardsCache.clear();
    deletedFoldersState.clear();
  });

  it('keeps deleted folder state when clearing the dashboard cache', () => {
    deletedFoldersState.markDeleted(['folder-1', 'folder-2']);

    deletedDashboardsCache.clear();

    expect(deletedFoldersState.isDeleted('folder-1')).toBe(true);
    expect(deletedFoldersState.isDeleted('folder-2')).toBe(true);
  });
});
