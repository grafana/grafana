import {
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  MOVE_ITEM,
  DELETE_ITEM,
  TOGGLE_CAN_MODIFY,
} from './actionTypes';
import { manageDashboardsReducer as reducer, manageDashboardsState as state } from './manageDashboards';
import { searchResults, sections } from '../testData';

describe('Manage dashboards reducer', () => {
  it('should return the initial state', () => {
    expect(reducer(state, {} as any)).toEqual(state);
  });

  it('should handle TOGGLE_ALL_CHECKED', () => {
    const newState = reducer({ ...state, results: sections }, { type: TOGGLE_ALL_CHECKED });
    expect(newState.results.every((result: any) => result.checked === true));
    expect(newState.allChecked).toBe(true);

    const newState2 = reducer({ ...newState, results: sections }, { type: TOGGLE_ALL_CHECKED });
    expect(newState2.results.every((result: any) => result.checked === false));
    expect(newState2.allChecked).toBe(false);
  });

  it('should handle TOGGLE_CAN_SAVE', () => {
    const newState = reducer(state, { type: TOGGLE_CAN_SAVE, payload: true });
    expect(newState.canSave).toBe(true);
  });

  it('should handle TOGGLE_CAN_MODIFY', () => {
    const newState = reducer(state, { type: TOGGLE_CAN_MODIFY });
    expect(newState.canMove).toBe(false);
    expect(newState.canDelete).toBe(false);

    const checkedSection: any = {
      id: 2568,
      uid: 'search-test-data',
      title: 'Search test data folder',
      expanded: false,
      items: [],
      url: '/dashboards/f/search-test-data/search-test-data-folder',
      icon: 'folder',
      score: 3,
      checked: true,
    };
    const newState2 = reducer({ ...state, results: [...searchResults, checkedSection] }, { type: TOGGLE_CAN_MODIFY });
    expect(newState2.canMove).toBe(false);
    expect(newState2.canDelete).toBe(true);

    const checkedItems: any = {
      id: 2568,
      uid: 'search-test-data',
      title: 'Search test data folder',
      expanded: false,
      items: [
        {
          id: 4072,
          uid: 'OzAIf_rWz',
          title: 'New dashboard Copy 3',
          type: 'dash-db',
          isStarred: false,
          checked: true,
        },
        {
          id: 46,
          uid: '8DY63kQZk',
          title: 'Stocks',
          type: 'dash-db',
          isStarred: false,
        },
        {
          id: 20,
          uid: '7MeksYbmk',
          title: 'Alerting with TestData',
          type: 'dash-db',
          isStarred: false,
          folderId: 2,
          checked: true,
        },
      ],
      url: '/dashboards/f/search-test-data/search-test-data-folder',
      icon: 'folder',
      score: 3,
      checked: false,
    };
    const newState3 = reducer({ ...state, results: [...searchResults, checkedItems] }, { type: TOGGLE_CAN_MODIFY });
    expect(newState3.canDelete).toBe(true);
    expect(newState3.canMove).toBe(true);

    const newState4 = reducer({ ...state, results: sections }, { type: TOGGLE_CAN_MODIFY });
    expect(newState4.canMove).toBe(false);
    expect(newState4.canDelete).toBe(false);
  });

  it('should handle TOGGLE_EDIT_PERMISSIONS', () => {
    const newState = reducer(state, { type: TOGGLE_EDIT_PERMISSIONS, payload: true });
    expect(newState.hasEditPermissionInFolders).toBe(true);
  });

  it('should handle TOGGLE_CHECKED', () => {
    const newState = reducer({ ...state, results: searchResults }, { type: TOGGLE_CHECKED, payload: searchResults[0] });
    expect(newState.results[0].checked).toBe(true);
    expect(newState.results[1].checked).toBe(false);

    const newState2 = reducer(newState, { type: TOGGLE_CHECKED, payload: searchResults[1] });
    expect(newState2.results[0].checked).toBe(true);
    expect(newState2.results[1].checked).toBe(true);
  });
});
