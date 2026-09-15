import { type DashboardViewItem } from 'app/features/search/types';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';

import { ancestorsOf, findItem } from './utils';

describe('browse-dashboards state utils', () => {
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

  describe('findItem', () => {
    it('returns the item of the requested kind when a folder and a dashboard share a UID', () => {
      expect(findItem([], childrenByParentUID, 'folder', 'same-uid')).toBe(folder);
      expect(findItem([], childrenByParentUID, 'dashboard', 'same-uid')).toBe(dashboard);
    });

    it('does not return a root item of another kind', () => {
      expect(findItem([dashboard], {}, 'folder', 'same-uid')).toBeUndefined();
    });
  });

  // Pulled one step at a time on purpose: a uid-only regression yields the dashboard as its own ancestor forever,
  // so spreading the generator would hang the worker instead of failing.
  describe('ancestorsOf', () => {
    const root: DashboardViewItem = { kind: 'folder', uid: 'parent', title: 'Parent' };

    it('yields the folder chain nearest first when a dashboard shares its parent UID', () => {
      const ancestors = ancestorsOf(dashboard, [root], childrenByParentUID);
      expect(ancestors.next().value).toBe(folder);
      expect(ancestors.next().value).toBe(root);
      expect(ancestors.next().done).toBe(true);
    });

    it('stops at the first ancestor that is not loaded', () => {
      const ancestors = ancestorsOf(dashboard, [], childrenByParentUID);
      expect(ancestors.next().value).toBe(folder);
      expect(ancestors.next().done).toBe(true);
    });
  });
});
