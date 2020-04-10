import {
  TOGGLE_FOLDER_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_SECTION_CHECKED,
  MOVE_ITEM,
  DELETE_ITEM,
  TOGGLE_STARRED,
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

  it('should handle TOGGLE_FOLDER_CAN_SAVE', () => {
    const newState = reducer(state, { type: TOGGLE_FOLDER_CAN_SAVE, payload: true });
    expect(newState.canSave).toBe(true);
  });

  it('should handle TOGGLE_EDIT_PERMISSIONS', () => {
    const newState = reducer(state, { type: TOGGLE_EDIT_PERMISSIONS, payload: true });
    expect(newState.hasEditPermissionInFolders).toBe(true);
  });
});
