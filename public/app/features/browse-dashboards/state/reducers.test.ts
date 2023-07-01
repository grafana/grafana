import { wellFormedDashboard, wellFormedFolder } from '../fixtures/dashboardsTreeItem.fixture';
import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';
import { BrowseDashboardsState } from '../types';

import { fetchNextChildrenPageFulfilled, setAllSelection, setFolderOpenState, setItemSelectionState } from './reducers';

function createInitialState(): BrowseDashboardsState {
  return {
    rootItems: undefined,
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: {
      $all: false,
      dashboard: {},
      folder: {},
      panel: {},
    },
  };
}

describe('browse-dashboards reducers', () => {
  describe('fetchNextChildrenPageFulfilled', () => {
    it('loads first page of root items', () => {
      const pageSize = 50;
      const state = createInitialState();
      const children = new Array(pageSize).fill(0).map((_, index) => wellFormedFolder(index + 1).item);

      const action = {
        payload: {
          children,
          kind: 'folder' as const,
          page: 1,
          lastPageOfKind: false,
        },
        type: 'action-type',
        meta: {
          arg: {
            parentUID: undefined,
            pageSize: pageSize,
          },
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      fetchNextChildrenPageFulfilled(state, action);

      expect(state.rootItems).toEqual({
        items: children,
        lastFetchedKind: 'folder',
        lastFetchedPage: 1,
        lastKindHasMoreItems: true,
        isFullyLoaded: false,
      });
    });

    it('loads last page of root items', () => {
      const pageSize = 50;
      const state = createInitialState();
      const firstPageChildren = new Array(20).fill(0).map((_, index) => wellFormedFolder(index + 1).item);
      state.rootItems = {
        items: firstPageChildren,
        lastFetchedKind: 'folder',
        lastFetchedPage: 1,
        lastKindHasMoreItems: false,
        isFullyLoaded: false,
      };

      const lastPageChildren = new Array(20).fill(0).map((_, index) => wellFormedDashboard(index + 51).item);
      const action = {
        payload: {
          children: lastPageChildren,
          kind: 'dashboard' as const,
          page: 1,
          lastPageOfKind: true,
        },
        type: 'action-type',
        meta: {
          arg: {
            parentUID: undefined,
            pageSize: pageSize,
          },
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      fetchNextChildrenPageFulfilled(state, action);

      expect(state.rootItems).toEqual({
        items: [...firstPageChildren, ...lastPageChildren],
        lastFetchedKind: 'dashboard',
        lastFetchedPage: 1,
        lastKindHasMoreItems: false,
        isFullyLoaded: true,
      });
    });

    it('updates state correctly for items in folders', () => {
      const state = createInitialState();
      const parentFolder = wellFormedFolder(1).item;
      const children = [wellFormedFolder(2).item, wellFormedDashboard(3).item];

      const action = {
        payload: {
          children,
          kind: 'dashboard' as const,
          page: 1,
          lastPageOfKind: true,
        },
        type: 'action-type',
        meta: {
          arg: {
            parentUID: parentFolder.uid,
            pageSize: 999,
          },
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      fetchNextChildrenPageFulfilled(state, action);

      expect(state.childrenByParentUID).toEqual({
        [parentFolder.uid]: {
          items: children,
          lastFetchedKind: 'dashboard',
          lastFetchedPage: 1,
          lastKindHasMoreItems: false,
          isFullyLoaded: true,
        },
      });
    });

    it('marks children as selected if the parent is selected', () => {
      const parentFolder = wellFormedFolder(1).item;

      const state = createInitialState();
      state.selectedItems.folder[parentFolder.uid] = true;

      const childFolder = wellFormedFolder(2).item;
      const childDashboard = wellFormedDashboard(3).item;

      const action = {
        payload: {
          children: [childFolder, childDashboard],
          kind: 'dashboard' as const,
          page: 1,
          lastPageOfKind: true,
        },
        type: 'action-type',
        meta: {
          arg: {
            parentUID: parentFolder.uid,
            pageSize: 999,
          },
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      fetchNextChildrenPageFulfilled(state, action);

      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [childDashboard.uid]: true,
        },
        folder: {
          [parentFolder.uid]: true,
          [childFolder.uid]: true,
        },
        panel: {},
      });
    });
  });

  describe('setFolderOpenState', () => {
    it('updates state correctly', () => {
      const state = createInitialState();
      const folderUID = 'abc-123';
      setFolderOpenState(state, { type: 'setFolderOpenState', payload: { folderUID, isOpen: true } });

      expect(state.openFolders).toEqual({ [folderUID]: true });
    });
  });

  describe('setItemSelectionState', () => {
    it('marks items as selected', () => {
      const folder = wellFormedFolder(1).item;
      const dashboard = wellFormedDashboard(2).item;
      const state = createInitialState();
      state.rootItems = fullyLoadedViewItemCollection([folder, dashboard]);

      setItemSelectionState(state, { type: 'setItemSelectionState', payload: { item: dashboard, isSelected: true } });

      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [dashboard.uid]: true,
        },
        folder: {},
        panel: {},
      });
    });

    it('marks descendants as selected when the parent folder is selected', () => {
      const state = createInitialState();

      const rootDashboard = wellFormedDashboard(1).item;
      const parentFolder = wellFormedFolder(2).item;
      const childDashboard = wellFormedDashboard(3, {}, { parentUID: parentFolder.uid }).item;
      const childFolder = wellFormedFolder(4, {}, { parentUID: parentFolder.uid }).item;
      const grandchildDashboard = wellFormedDashboard(5, {}, { parentUID: childFolder.uid }).item;

      state.rootItems = fullyLoadedViewItemCollection([parentFolder, rootDashboard]);
      state.childrenByParentUID[parentFolder.uid] = fullyLoadedViewItemCollection([childDashboard, childFolder]);
      state.childrenByParentUID[childFolder.uid] = fullyLoadedViewItemCollection([grandchildDashboard]);

      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: parentFolder, isSelected: true },
      });

      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [childDashboard.uid]: true,
          [grandchildDashboard.uid]: true,
        },
        folder: {
          [parentFolder.uid]: true,
          [childFolder.uid]: true,
        },
        panel: {},
      });
    });

    it('unselects parents when items are unselected', () => {
      const state = createInitialState();

      const parentFolder = wellFormedFolder(1).item;
      const childDashboard = wellFormedDashboard(2, {}, { parentUID: parentFolder.uid }).item;
      const childFolder = wellFormedFolder(3, {}, { parentUID: parentFolder.uid }).item;
      const grandchildDashboard = wellFormedDashboard(4, {}, { parentUID: childFolder.uid }).item;

      state.rootItems = fullyLoadedViewItemCollection([parentFolder]);
      state.childrenByParentUID[parentFolder.uid] = fullyLoadedViewItemCollection([childDashboard, childFolder]);
      state.childrenByParentUID[childFolder.uid] = fullyLoadedViewItemCollection([grandchildDashboard]);

      state.selectedItems.dashboard[childDashboard.uid] = true;
      state.selectedItems.dashboard[grandchildDashboard.uid] = true;
      state.selectedItems.folder[parentFolder.uid] = true;
      state.selectedItems.folder[childFolder.uid] = true;

      // Unselect the deepest grandchild dashboard
      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: grandchildDashboard, isSelected: false },
      });

      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [childDashboard.uid]: true,
          [grandchildDashboard.uid]: false,
        },
        folder: {
          [parentFolder.uid]: false,
          [childFolder.uid]: false,
        },
        panel: {},
      });
    });

    it('selects the $all header checkbox when all descendants are now selected', () => {
      const state = createInitialState();

      const rootDashboard = wellFormedDashboard(1).item;
      const rootFolder = wellFormedFolder(2).item;
      const childDashboardA = wellFormedDashboard(3, {}, { parentUID: rootFolder.uid }).item;
      const childDashboardB = wellFormedDashboard(4, {}, { parentUID: rootFolder.uid }).item;

      state.rootItems = fullyLoadedViewItemCollection([rootFolder, rootDashboard]);
      state.childrenByParentUID[rootFolder.uid] = fullyLoadedViewItemCollection([childDashboardA, childDashboardB]);

      state.selectedItems.dashboard = { [rootDashboard.uid]: true, [childDashboardA.uid]: true };

      // Selects the root folder
      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: rootFolder, isSelected: true },
      });

      expect(state.selectedItems.$all).toBeTruthy();
    });

    it('unselects the $all header checkbox if a descendant is unselected', () => {
      const state = createInitialState();

      const rootDashboard = wellFormedDashboard(1).item;
      const rootFolder = wellFormedFolder(2).item;
      const childDashboardA = wellFormedDashboard(3, {}, { parentUID: rootFolder.uid }).item;
      const childDashboardB = wellFormedDashboard(4, {}, { parentUID: rootFolder.uid }).item;

      state.rootItems = fullyLoadedViewItemCollection([rootFolder, rootDashboard]);
      state.childrenByParentUID[rootFolder.uid] = fullyLoadedViewItemCollection([childDashboardA, childDashboardB]);

      state.selectedItems.dashboard = {
        [rootDashboard.uid]: true,
        [childDashboardA.uid]: true,
        [childDashboardB.uid]: true,
      };
      state.selectedItems.folder = { [rootFolder.uid]: true };

      // Selected the deepest grandchild dashboard
      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: childDashboardB, isSelected: false },
      });

      expect(state.selectedItems.$all).toBeFalsy();
    });
  });

  describe('setAllSelection', () => {
    let seed = 1;
    const topLevelDashboard = wellFormedDashboard(seed++).item;
    const topLevelFolder = wellFormedFolder(seed++).item;
    const childDashboard = wellFormedDashboard(seed++, {}, { parentUID: topLevelFolder.uid }).item;
    const childFolder = wellFormedFolder(seed++, {}, { parentUID: topLevelFolder.uid }).item;
    const grandchildDashboard = wellFormedDashboard(seed++, {}, { parentUID: childFolder.uid }).item;

    it('selects all items in the root folder', () => {
      const state = createInitialState();

      state.rootItems = fullyLoadedViewItemCollection([topLevelFolder, topLevelDashboard]);
      state.childrenByParentUID[topLevelFolder.uid] = fullyLoadedViewItemCollection([childDashboard, childFolder]);
      state.childrenByParentUID[childFolder.uid] = fullyLoadedViewItemCollection([grandchildDashboard]);

      state.selectedItems.folder[childFolder.uid] = false;
      state.selectedItems.dashboard[grandchildDashboard.uid] = true;

      setAllSelection(state, { type: 'setAllSelection', payload: { isSelected: true, folderUID: undefined } });

      expect(state.selectedItems).toEqual({
        $all: true,
        dashboard: {
          [topLevelDashboard.uid]: true,
          [childDashboard.uid]: true,
          [grandchildDashboard.uid]: true,
        },
        folder: {
          [topLevelFolder.uid]: true,
          [childFolder.uid]: true,
        },
        panel: {},
      });
    });

    it('selects all items when viewing a folder', () => {
      const state = createInitialState();

      state.rootItems = fullyLoadedViewItemCollection([topLevelFolder, topLevelDashboard]);
      state.childrenByParentUID[topLevelFolder.uid] = fullyLoadedViewItemCollection([childDashboard, childFolder]);
      state.childrenByParentUID[childFolder.uid] = fullyLoadedViewItemCollection([grandchildDashboard]);

      state.selectedItems.folder[childFolder.uid] = false;
      state.selectedItems.dashboard[grandchildDashboard.uid] = true;

      setAllSelection(state, { type: 'setAllSelection', payload: { isSelected: true, folderUID: topLevelFolder.uid } });

      expect(state.selectedItems).toEqual({
        $all: true,
        dashboard: {
          [childDashboard.uid]: true,
          [grandchildDashboard.uid]: true,
        },
        folder: {
          [childFolder.uid]: true,
        },
        panel: {},
      });
    });

    it('deselects all items', () => {
      const state = createInitialState();

      state.rootItems = fullyLoadedViewItemCollection([topLevelFolder, topLevelDashboard]);
      state.childrenByParentUID[topLevelFolder.uid] = fullyLoadedViewItemCollection([childDashboard, childFolder]);
      state.childrenByParentUID[childFolder.uid] = fullyLoadedViewItemCollection([grandchildDashboard]);

      state.selectedItems.folder[childFolder.uid] = false;
      state.selectedItems.dashboard[grandchildDashboard.uid] = true;

      setAllSelection(state, { type: 'setAllSelection', payload: { isSelected: false, folderUID: undefined } });

      // Deselecting only sets selection = false for things already selected
      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [grandchildDashboard.uid]: false,
        },
        folder: {
          [childFolder.uid]: false,
        },
        panel: {},
      });
    });
  });
});
