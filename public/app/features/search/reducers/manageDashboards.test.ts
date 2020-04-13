import {
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  // MOVE_ITEM,
  // DELETE_ITEM,
} from './actionTypes';
import { manageDashboardsReducer as reducer, manageDashboardsState as state } from './manageDashboards';
import { sections } from '../testData';

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

  it('should handle TOGGLE_EDIT_PERMISSIONS', () => {
    const newState = reducer(state, { type: TOGGLE_EDIT_PERMISSIONS, payload: true });
    expect(newState.hasEditPermissionInFolders).toBe(true);
  });

  it('should handle TOGGLE_CHECKED', () => {
    const newState = reducer({ ...state, results: sections }, { type: TOGGLE_CHECKED, payload: sections[2] });
    expect(newState.results[2].checked).toBe(true);
    expect(newState.results[3].checked).toBeFalsy();

    const newState2 = reducer(newState, { type: TOGGLE_CHECKED, payload: sections[1] });
    expect(newState2.results[0].checked).toBe(true);
    expect(newState2.results[1].checked).toBe(true);
  });
});
