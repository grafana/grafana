import { wellFormedDashboard, wellFormedFolder } from '../fixtures/dashboardsTreeItem.fixture';
import { BrowseDashboardsState } from '../types';

import { extraReducerFetchChildrenFulfilled, setFolderOpenState, setItemSelectionState } from './reducers';

function createInitialState(): BrowseDashboardsState {
  return {
    rootItems: [],
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: {
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
      const state = createInitialState();
      const dashboard = wellFormedDashboard().item;

      setItemSelectionState(state, { type: 'setItemSelectionState', payload: { item: dashboard, isSelected: true } });

      expect(state.selectedItems).toEqual({
        dashboard: {
          [dashboard.uid]: true,
        },
        folder: {},
        panel: {},
      });
    });

    it('marks descendants as selected when the parent folder is selected', () => {
      const state = createInitialState();

      const parentFolder = wellFormedFolder(1).item;
      const childDashboard = wellFormedDashboard(2, {}, { parentUID: parentFolder.uid }).item;
      const childFolder = wellFormedFolder(3, {}, { parentUID: parentFolder.uid }).item;
      const grandchildDashboard = wellFormedDashboard(4, {}, { parentUID: childFolder.uid }).item;

      state.childrenByParentUID[parentFolder.uid] = [childDashboard, childFolder];
      state.childrenByParentUID[childFolder.uid] = [grandchildDashboard];

      setItemSelectionState(state, {
        type: 'setItemSelectionState',
        payload: { item: parentFolder, isSelected: true },
      });

      expect(state.selectedItems).toEqual({
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
  });
});
