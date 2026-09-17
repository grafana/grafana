import { type DashboardViewItem } from 'app/features/search/types';

import { type BrowseDashboardsState } from '../types';

import { getSelectedItemRefs, getSelectedUIDs, getTopLevelSelectedUIDs } from './dashboards';

describe('browse-dashboards selection helpers', () => {
  const selection = {
    folder: { 'folder-a': true, 'folder-b': false, 'folder-c': true },
    dashboard: { 'dash-a': false, 'dash-b': true },
  };

  describe('getSelectedUIDs', () => {
    it('returns only the UIDs of the requested kind that are selected', () => {
      expect(getSelectedUIDs(selection, 'folder')).toEqual(['folder-a', 'folder-c']);
      expect(getSelectedUIDs(selection, 'dashboard')).toEqual(['dash-b']);
    });

    it('returns an empty array when nothing is selected', () => {
      expect(getSelectedUIDs({ folder: {}, dashboard: {} }, 'folder')).toEqual([]);
    });
  });

  describe('getSelectedItemRefs', () => {
    it('lists selected folders before selected dashboards', () => {
      expect(getSelectedItemRefs(selection)).toEqual([
        { kind: 'folder', uid: 'folder-a' },
        { kind: 'folder', uid: 'folder-c' },
        { kind: 'dashboard', uid: 'dash-b' },
      ]);
    });
  });

  describe('getTopLevelSelectedUIDs', () => {
    const rootItems: DashboardViewItem[] = [{ kind: 'folder', uid: 'folder-a', title: 'Folder A' }];
    const childrenByUID: BrowseDashboardsState['childrenByParentUID'] = {
      'folder-a': {
        items: [
          { kind: 'folder', uid: 'folder-c', title: 'Folder C', parentUID: 'folder-a' },
          { kind: 'dashboard', uid: 'dash-b', title: 'Dash B', parentUID: 'folder-a' },
        ],
        lastFetchedKind: 'folder',
        lastFetchedPage: 1,
        lastKindHasMoreItems: false,
        isFullyLoaded: true,
      },
    };

    it('drops selected items whose direct parent folder is also selected', () => {
      // folder-a and folder-c are both selected, but folder-c is a child of folder-a -- deleting
      // folder-a already cascades to folder-c, so folder-c shouldn't get its own delete call.
      // dash-b is also a child of folder-a and gets dropped the same way.
      const nestedSelection = {
        folder: { 'folder-a': true, 'folder-c': true },
        dashboard: { 'dash-b': true },
      };

      expect(getTopLevelSelectedUIDs(nestedSelection, rootItems, childrenByUID)).toEqual({
        folders: ['folder-a'],
        dashboards: [],
      });
    });

    it('keeps selected items whose parent is not selected', () => {
      const selectionWithoutParent = {
        folder: { 'folder-c': true },
        dashboard: { 'dash-b': true },
      };

      expect(getTopLevelSelectedUIDs(selectionWithoutParent, rootItems, childrenByUID)).toEqual({
        folders: ['folder-c'],
        dashboards: ['dash-b'],
      });
    });
  });
});
