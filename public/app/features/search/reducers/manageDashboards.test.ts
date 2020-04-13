import {
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  DELETE_ITEMS,
} from './actionTypes';
import { manageDashboardsReducer as reducer, manageDashboardsState as state } from './manageDashboards';
import { sections } from '../testData';
import { UidsToDelete } from '../types';

// Remove Recent and Starred sections as they're not used in manage dashboards
const results = sections.slice(2);

describe('Manage dashboards reducer', () => {
  it('should return the initial state', () => {
    expect(reducer(state, {} as any)).toEqual(state);
  });

  it('should handle TOGGLE_ALL_CHECKED', () => {
    const newState = reducer({ ...state, results }, { type: TOGGLE_ALL_CHECKED });
    expect(newState.results.every((result: any) => result.checked === true));
    expect(newState.allChecked).toBe(true);

    const newState2 = reducer({ ...newState, results }, { type: TOGGLE_ALL_CHECKED });
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
    const newState = reducer({ ...state, results }, { type: TOGGLE_CHECKED, payload: results[0] });
    expect(newState.results[0].checked).toBe(true);
    expect(newState.results[1].checked).toBeFalsy();

    const newState2 = reducer(newState, { type: TOGGLE_CHECKED, payload: results[1] });
    expect(newState2.results[0].checked).toBe(true);
    expect(newState2.results[1].checked).toBe(true);
  });

  it('should handle DELETE_ITEMS', () => {
    const toDelete: UidsToDelete = { dashboards: ['OzAIf_rWz', 'lBdLINUWk'], folders: ['search-test-data'] };
    const newState = reducer({ ...state, results }, { type: DELETE_ITEMS, payload: toDelete });
    expect(newState.results).toHaveLength(3);
    expect(newState.results[1].id).toEqual(4074);
    expect(newState.results[2].items).toHaveLength(1);
    expect(newState.results[2].items[0].id).toEqual(4069);
  });
});
