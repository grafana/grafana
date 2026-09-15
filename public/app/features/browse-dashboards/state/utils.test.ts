import { type DashboardViewItem } from 'app/features/search/types';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';

import { findItem } from './utils';

describe('findItem', () => {
  // Unified storage namespaces UIDs per kind, so a dashboard may share its parent folder's UID
  const folder: DashboardViewItem = { kind: 'folder', uid: 'same-uid', title: 'Folder', parentUID: 'parent' };
  const dashboard: DashboardViewItem = {
    kind: 'dashboard',
    uid: 'same-uid',
    title: 'Dashboard',
    parentUID: 'same-uid',
  };
  // The dashboard's collection comes first so a uid-only match would return the dashboard for both kinds
  const childrenByParentUID = {
    'same-uid': fullyLoadedViewItemCollection([dashboard]),
    parent: fullyLoadedViewItemCollection([folder]),
  };

  it('returns the item of the requested kind when a folder and a dashboard share a UID', () => {
    expect(findItem([], childrenByParentUID, 'folder', 'same-uid')).toBe(folder);
    expect(findItem([], childrenByParentUID, 'dashboard', 'same-uid')).toBe(dashboard);
  });

  it('does not return a root item of another kind', () => {
    expect(findItem([dashboard], {}, 'folder', 'same-uid')).toBeUndefined();
  });
});
