import { clearPanes, splitClose } from '../../state/main';

import {
  signalExplorerReducer,
  setSelectedMetric,
  clearSelectedMetric,
  setSearchText,
  setTypeFilter,
  setActiveRefId,
  clearExploreState,
} from './signalExplorerSlice';

const initial = signalExplorerReducer(undefined, { type: '@@INIT' });

describe('signalExplorerSlice', () => {
  it('sets selected metric per exploreId in isolation', () => {
    const s1 = signalExplorerReducer(initial, setSelectedMetric({ exploreId: 'left', refId: 'A', metricName: 'up' }));
    expect(s1['left'].selectedMetric).toEqual({ refId: 'A', metricName: 'up' });
    const s2 = signalExplorerReducer(
      s1,
      setSelectedMetric({ exploreId: 'right', refId: 'B', metricName: 'node_load1' })
    );
    expect(s2['left'].selectedMetric).toEqual({ refId: 'A', metricName: 'up' }); // untouched
    expect(s2['right'].selectedMetric).toEqual({ refId: 'B', metricName: 'node_load1' });
  });
  it('sets type filter and search text and active refId', () => {
    let s = signalExplorerReducer(initial, setTypeFilter({ exploreId: 'left', refId: 'A', typeFilter: 'counter' }));
    s = signalExplorerReducer(s, setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }));
    s = signalExplorerReducer(s, setActiveRefId({ exploreId: 'left', refId: 'A' }));
    expect(s['left'].cards['A']).toEqual({ typeFilter: 'counter', searchText: 'node_' });
    expect(s['left'].activeRefId).toBe('A');
  });

  it('scopes search text to one card, so a sibling card in the same pane keeps its own', () => {
    let s = signalExplorerReducer(initial, setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }));
    s = signalExplorerReducer(s, setSearchText({ exploreId: 'left', refId: 'B', searchText: 'http_' }));

    expect(s['left'].cards['A'].searchText).toBe('node_');
    expect(s['left'].cards['B'].searchText).toBe('http_');
  });

  it('scopes the type filter to one card, so a sibling card in the same pane keeps its own', () => {
    let s = signalExplorerReducer(initial, setTypeFilter({ exploreId: 'left', refId: 'A', typeFilter: 'counter' }));
    s = signalExplorerReducer(s, setTypeFilter({ exploreId: 'left', refId: 'B', typeFilter: 'gauge' }));

    expect(s['left'].cards['A'].typeFilter).toBe('counter');
    expect(s['left'].cards['B'].typeFilter).toBe('gauge');
  });

  it('keeps a card’s search text when its type filter changes, and the reverse', () => {
    let s = signalExplorerReducer(initial, setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }));
    s = signalExplorerReducer(s, setTypeFilter({ exploreId: 'left', refId: 'A', typeFilter: 'gauge' }));

    expect(s['left'].cards['A']).toEqual({ typeFilter: 'gauge', searchText: 'node_' });
  });
  it('clears the selected metric of one exploreId without touching the rest of the pane', () => {
    let s = signalExplorerReducer(initial, setSelectedMetric({ exploreId: 'left', refId: 'A', metricName: 'up' }));
    s = signalExplorerReducer(s, setActiveRefId({ exploreId: 'left', refId: 'A' }));
    s = signalExplorerReducer(s, setSelectedMetric({ exploreId: 'right', refId: 'B', metricName: 'up' }));

    s = signalExplorerReducer(s, clearSelectedMetric({ exploreId: 'left' }));

    expect(s['left'].selectedMetric).toBeUndefined();
    expect(s['left'].activeRefId).toBe('A');
    expect(s['right'].selectedMetric).toEqual({ refId: 'B', metricName: 'up' });
  });
  it('ignores clearing the selected metric of an unknown exploreId', () => {
    expect(signalExplorerReducer(initial, clearSelectedMetric({ exploreId: 'left' }))).toEqual(initial);
  });
  it('clears one exploreId', () => {
    const s1 = signalExplorerReducer(initial, setActiveRefId({ exploreId: 'left', refId: 'A' }));
    const s2 = signalExplorerReducer(s1, clearExploreState({ exploreId: 'left' }));
    expect(s2['left']).toBeUndefined();
  });

  describe('pane lifecycle', () => {
    const populated = () => {
      let s = signalExplorerReducer(initial, setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }));
      s = signalExplorerReducer(s, setSelectedMetric({ exploreId: 'left', refId: 'A', metricName: 'up' }));
      s = signalExplorerReducer(s, setSearchText({ exploreId: 'right', refId: 'A', searchText: 'http_' }));
      return s;
    };

    // The slice matches these action types as literals to avoid a require cycle with `main.ts`.
    it('matches the action types Explore actually dispatches', () => {
      expect(splitClose.type).toBe('explore/splitClose');
      expect(clearPanes.type).toBe('explore/clearPanes');
    });

    it('drops a closed pane so a recycled exploreId cannot inherit its view state', () => {
      const s = signalExplorerReducer(populated(), splitClose('left'));

      expect(s['left']).toBeUndefined();
      expect(s['right'].cards['A'].searchText).toBe('http_');
    });

    it('drops every pane when Explore clears them all', () => {
      expect(signalExplorerReducer(populated(), clearPanes())).toEqual({});
    });
  });
});
