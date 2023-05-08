import { wellFormedDashboard, wellFormedFolder } from '../fixtures/dashboardsTreeItem.fixture';
import { BrowseDashboardsState } from '../types';

import {
  extraReducerFetchChildrenFulfilled,
  setAllSelection,
  setFolderOpenState,
  setItemSelectionState,
} from './reducers';

function createInitialState(): BrowseDashboardsState {
  return {
    rootItems: [],
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
  describe('extraReducerFetchChildrenFulfilled', () => {
    it('updates state correctly for root items', () => {
      const state = createInitialState();
      const children = [
        wellFormedFolder(1).item,
        wellFormedFolder(2).item,
        wellFormedFolder(3).item,
        wellFormedDashboard(4).item,
      ];

      const action = {
        payload: children,
        type: 'action-type',
        meta: {
          arg: undefined,
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      extraReducerFetchChildrenFulfilled(state, action);

      expect(state.rootItems).toEqual(children);
    });

    it('updates state correctly for items in folders', () => {
      const state = createInitialState();
      const parentFolder = wellFormedFolder(1).item;
      const children = [wellFormedFolder(2).item, wellFormedDashboard(3).item];

      const action = {
        payload: children,
        type: 'action-type',
        meta: {
          arg: parentFolder.uid,
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      extraReducerFetchChildrenFulfilled(state, action);

      expect(state.childrenByParentUID).toEqual({ [parentFolder.uid]: children });
    });

    it('marks children as selected if the parent is selected', () => {
      const parentFolder = wellFormedFolder(1).item;

      const state = createInitialState();
      state.selectedItems.folder[parentFolder.uid] = true;

      const childFolder = wellFormedFolder(2).item;
      const childDashboard = wellFormedDashboard(3).item;

      const action = {
        payload: [childFolder, childDashboard],
        type: 'action-type',
        meta: {
          arg: parentFolder.uid,
          requestId: 'abc-123',
          requestStatus: 'fulfilled' as const,
        },
      };

      extraReducerFetchChildrenFulfilled(state, action);

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
      state.rootItems = [folder, dashboard];

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

      state.rootItems = [parentFolder, rootDashboard];
      state.childrenByParentUID[parentFolder.uid] = [childDashboard, childFolder];
      state.childrenByParentUID[childFolder.uid] = [grandchildDashboard];

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

      state.rootItems = [parentFolder];
      state.childrenByParentUID[parentFolder.uid] = [childDashboard, childFolder];
      state.childrenByParentUID[childFolder.uid] = [grandchildDashboard];

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

    it('selects ancestors when all their children are now selected', () => {
      const state = createInitialState();

      const rootDashboard = wellFormedDashboard(1).item;
      const parentFolder = wellFormedFolder(2).item;
      const childDashboard = wellFormedDashboard(3, {}, { parentUID: parentFolder.uid }).item;
      const childFolder = wellFormedFolder(4, {}, { parentUID: parentFolder.uid }).item;
      const grandchildDashboard = wellFormedDashboard(5, {}, { parentUID: childFolder.uid }).item;

      state.rootItems = [parentFolder, rootDashboard];
      state.childrenByParentUID[parentFolder.uid] = [childDashboard, childFolder];
      state.childrenByParentUID[childFolder.uid] = [grandchildDashboard];

      // Selected the deepest grandchild dashboard
      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: grandchildDashboard, isSelected: true },
      });

      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [grandchildDashboard.uid]: true,
        },
        folder: {
          [parentFolder.uid]: false,
          [childFolder.uid]: true, // is selected because all it's children (grandchildDashboard) is selected
        },
        panel: {},
      });

      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: childDashboard, isSelected: true },
      });

      expect(state.selectedItems).toEqual({
        $all: false,
        dashboard: {
          [childDashboard.uid]: true,
          [grandchildDashboard.uid]: true,
        },
        folder: {
          [parentFolder.uid]: true, // is now selected because we also selected its other child
          [childFolder.uid]: true,
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

      state.rootItems = [rootFolder, rootDashboard];
      state.childrenByParentUID[rootFolder.uid] = [childDashboardA, childDashboardB];

      state.selectedItems.dashboard = { [rootDashboard.uid]: true, [childDashboardA.uid]: true };

      // Selected the deepest grandchild dashboard
      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: childDashboardB, isSelected: true },
      });

      expect(state.selectedItems.$all).toBeTruthy();
    });

    it('unselects the $all header checkbox a descendant is unselected', () => {
      const state = createInitialState();

      const rootDashboard = wellFormedDashboard(1).item;
      const rootFolder = wellFormedFolder(2).item;
      const childDashboardA = wellFormedDashboard(3, {}, { parentUID: rootFolder.uid }).item;
      const childDashboardB = wellFormedDashboard(4, {}, { parentUID: rootFolder.uid }).item;

      state.rootItems = [rootFolder, rootDashboard];
      state.childrenByParentUID[rootFolder.uid] = [childDashboardA, childDashboardB];

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
    it('selects all loaded items', () => {
      const state = createInitialState();

      let seed = 1;
      const topLevelDashboard = wellFormedDashboard(seed++).item;
      const topLevelFolder = wellFormedFolder(seed++).item;
      const childDashboard = wellFormedDashboard(seed++, {}, { parentUID: topLevelFolder.uid }).item;
      const childFolder = wellFormedFolder(seed++, {}, { parentUID: topLevelFolder.uid }).item;
      const grandchildDashboard = wellFormedDashboard(seed++, {}, { parentUID: childFolder.uid }).item;

      state.rootItems = [topLevelFolder, topLevelDashboard];
      state.childrenByParentUID[topLevelFolder.uid] = [childDashboard, childFolder];
      state.childrenByParentUID[childFolder.uid] = [grandchildDashboard];

      state.selectedItems.folder[childFolder.uid] = false;
      state.selectedItems.dashboard[grandchildDashboard.uid] = true;

      setAllSelection(state, { type: 'setAllSelection', payload: { isSelected: true } });

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

    it('deselects all items', () => {
      const state = createInitialState();

      let seed = 1;
      const topLevelDashboard = wellFormedDashboard(seed++).item;
      const topLevelFolder = wellFormedFolder(seed++).item;
      const childDashboard = wellFormedDashboard(seed++, {}, { parentUID: topLevelFolder.uid }).item;
      const childFolder = wellFormedFolder(seed++, {}, { parentUID: topLevelFolder.uid }).item;
      const grandchildDashboard = wellFormedDashboard(seed++, {}, { parentUID: childFolder.uid }).item;

      state.rootItems = [topLevelFolder, topLevelDashboard];
      state.childrenByParentUID[topLevelFolder.uid] = [childDashboard, childFolder];
      state.childrenByParentUID[childFolder.uid] = [grandchildDashboard];

      state.selectedItems.folder[childFolder.uid] = false;
      state.selectedItems.dashboard[grandchildDashboard.uid] = true;

      setAllSelection(state, { type: 'setAllSelection', payload: { isSelected: false } });

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
