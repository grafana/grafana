import { TOGGLE_ALL_CHECKED, TOGGLE_CHECKED, DELETE_ITEMS, MOVE_ITEMS } from './actionTypes';
import { manageDashboardsReducer as reducer, manageDashboardsState as state } from './manageDashboards';
import { sections } from '../testData';
import { DashboardSection, UidsToDelete } from '../types';

// Remove Recent and Starred sections as they're not used in manage dashboards
const results = sections.slice(2);

describe('Manage dashboards reducer', () => {
  it('should return the initial state', () => {
    expect(reducer(state, {} as any)).toEqual(state);
  });

  it('should handle TOGGLE_ALL_CHECKED', () => {
    const newState = reducer({ ...state, results }, { type: TOGGLE_ALL_CHECKED });
    expect(newState.results.every((result: any) => result.checked === true)).toBe(true);
    expect(newState.results.every((result: any) => result.items.every((item: any) => item.checked === true))).toBe(
      true
    );
    expect(newState.allChecked).toBe(true);

    const newState2 = reducer({ ...newState, results }, { type: TOGGLE_ALL_CHECKED });
    expect(newState2.results.every((result: any) => result.checked === false)).toBe(true);
    expect(newState2.results.every((result: any) => result.items.every((item: any) => item.checked === false))).toBe(
      true
    );
    expect(newState2.allChecked).toBe(false);
  });

  it('should handle TOGGLE_CHECKED sections', () => {
    const newState = reducer({ ...state, results }, { type: TOGGLE_CHECKED, payload: results[0] });
    expect(newState.results[0].checked).toBe(true);
    expect(newState.results[1].checked).toBeFalsy();

    const newState2 = reducer(newState, { type: TOGGLE_CHECKED, payload: results[1] });
    expect(newState2.results[0].checked).toBe(true);
    expect(newState2.results[1].checked).toBe(true);
  });

  it('should handle TOGGLE_CHECKED items', () => {
    const newState = reducer({ ...state, results }, { type: TOGGLE_CHECKED, payload: { id: 4069 } });
    expect(newState.results[3].items[0].checked).toBe(true);

    const newState2 = reducer(newState, { type: TOGGLE_CHECKED, payload: { id: 1 } });
    expect(newState2.results[3].items[0].checked).toBe(true);
    expect(newState2.results[3].items[1].checked).toBeFalsy();
    expect(newState2.results[3].items[2].checked).toBe(true);
  });

  it('should handle DELETE_ITEMS', () => {
    const toDelete: UidsToDelete = { dashboards: ['OzAIf_rWz', 'lBdLINUWk'], folders: ['search-test-data'] };
    const newState = reducer({ ...state, results }, { type: DELETE_ITEMS, payload: toDelete });
    expect(newState.results).toHaveLength(3);
    expect(newState.results[1].id).toEqual(4074);
    expect(newState.results[2].items).toHaveLength(1);
    expect(newState.results[2].items[0].id).toEqual(4069);
  });

  it('should handle MOVE_ITEMS', () => {
    // Move 2 dashboards to a folder with id 2
    const toMove = {
      dashboards: [
        {
          id: 4072,
          uid: 'OzAIf_rWz',
          title: 'New dashboard Copy 3',
          type: 'dash-db',
          isStarred: false,
        },
        {
          id: 1,
          uid: 'lBdLINUWk',
          title: 'Prom dash',
          type: 'dash-db',
          isStarred: true,
        },
      ],
      folder: { id: 2 },
    };
    const newState = reducer({ ...state, results }, { type: MOVE_ITEMS, payload: toMove });
    expect(newState.results[0].items).toHaveLength(2);
    expect(newState.results[0].items[0].uid).toEqual('OzAIf_rWz');
    expect(newState.results[0].items[1].uid).toEqual('lBdLINUWk');
    expect(newState.results[3].items).toHaveLength(1);
    expect(newState.results[3].items[0].uid).toEqual('LCFWfl9Zz');
  });

  it('should not display dashboards in a non-expanded folder', () => {
    const general = results.find(res => res.id === 0);
    const toMove = { dashboards: general?.items, folder: { id: 4074 } };
    const newState = reducer({ ...state, results }, { type: MOVE_ITEMS, payload: toMove });
    expect(newState.results.find((res: DashboardSection) => res.id === 4074).items).toHaveLength(0);
    expect(newState.results.find((res: DashboardSection) => res.id === 0).items).toHaveLength(0);
  });
});
