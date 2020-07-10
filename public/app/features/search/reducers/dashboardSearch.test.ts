import { FETCH_ITEMS, FETCH_RESULTS, TOGGLE_SECTION, MOVE_SELECTION_DOWN, MOVE_SELECTION_UP } from './actionTypes';
import { searchReducer as reducer, dashboardsSearchState } from './dashboardSearch';
import { searchResults, sections } from '../testData';

const defaultState = { selectedIndex: 0, loading: false, results: sections as any[], initialLoading: false };
describe('Dashboard Search reducer', () => {
  it('should return the initial state', () => {
    expect(reducer(dashboardsSearchState, {} as any)).toEqual(dashboardsSearchState);
  });

  it('should set the results and mark first item as selected', () => {
    const newState = reducer(dashboardsSearchState, { type: FETCH_RESULTS, payload: searchResults });
    expect(newState).toEqual({ loading: false, selectedIndex: 0, results: searchResults, initialLoading: false });
    expect(newState.results[0].selected).toBeTruthy();
  });

  it('should toggle selected section', () => {
    const newState = reducer(defaultState, { type: TOGGLE_SECTION, payload: sections[5] });
    expect(newState.results[5].expanded).toBeFalsy();
    const newState2 = reducer(defaultState, { type: TOGGLE_SECTION, payload: sections[1] });
    expect(newState2.results[1].expanded).toBeTruthy();
  });

  it('should handle FETCH_ITEMS', () => {
    const items = [
      {
        id: 4072,
        uid: 'OzAIf_rWz',
        title: 'New dashboard Copy 3',
        type: 'dash-db',
        isStarred: false,
      },
      {
        id: 46,
        uid: '8DY63kQZk',
        title: 'Stocks',
        type: 'dash-db',
        isStarred: false,
      },
    ];
    const newState = reducer(defaultState, {
      type: FETCH_ITEMS,
      payload: {
        section: sections[2],
        items,
      },
    });
    expect(newState.results[2].items).toEqual(items);
  });

  it('should handle MOVE_SELECTION_DOWN', () => {
    const newState = reducer(defaultState, {
      type: MOVE_SELECTION_DOWN,
    });

    expect(newState.selectedIndex).toEqual(1);
    expect(newState.results[0].items[0].selected).toBeTruthy();

    const newState2 = reducer(newState, {
      type: MOVE_SELECTION_DOWN,
    });

    expect(newState2.selectedIndex).toEqual(2);
    expect(newState2.results[1].selected).toBeTruthy();

    // Shouldn't go over the visible results length - 1 (9)
    const newState3 = reducer(
      { ...defaultState, selectedIndex: 9 },
      {
        type: MOVE_SELECTION_DOWN,
      }
    );
    expect(newState3.selectedIndex).toEqual(9);
  });

  it('should handle MOVE_SELECTION_UP', () => {
    // shouldn't move beyond 0
    const newState = reducer(defaultState, {
      type: MOVE_SELECTION_UP,
    });

    expect(newState.selectedIndex).toEqual(0);

    const newState2 = reducer(
      { ...defaultState, selectedIndex: 3 },
      {
        type: MOVE_SELECTION_UP,
      }
    );
    expect(newState2.selectedIndex).toEqual(2);
    expect(newState2.results[1].selected).toBeTruthy();
  });
});
