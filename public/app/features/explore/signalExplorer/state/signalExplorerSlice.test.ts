import type { DataQuery } from '@grafana/data';

import { clearPanes, splitClose } from '../../state/main';
import { changeQueries, changeQueriesAction, setQueriesAction } from '../../state/query';

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

  describe('query lifecycle', () => {
    const query = (refId: string): DataQuery => ({ refId });

    // `getNextRefId` hands out the first *unused* letter, so deleting query B and adding one makes
    // the new query B as well. Without pruning it would open with the deleted query's search text.
    const twoCards = () => {
      let s = signalExplorerReducer(initial, setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }));
      s = signalExplorerReducer(s, setTypeFilter({ exploreId: 'left', refId: 'B', typeFilter: 'counter' }));
      s = signalExplorerReducer(s, setSearchText({ exploreId: 'left', refId: 'B', searchText: 'http_' }));
      s = signalExplorerReducer(s, setActiveRefId({ exploreId: 'left', refId: 'B' }));
      s = signalExplorerReducer(s, setSelectedMetric({ exploreId: 'left', refId: 'B', metricName: 'up' }));
      return s;
    };

    it('matches the action types Explore actually dispatches', () => {
      expect(changeQueriesAction.type).toBe('explore/changeQueries');
      expect(setQueriesAction.type).toBe('explore/setQueries');
    });

    it('drops the card state of a query that no longer exists, so a recycled refId opens unfiltered', () => {
      const s = signalExplorerReducer(twoCards(), changeQueriesAction({ exploreId: 'left', queries: [query('A')] }));

      expect(s['left'].cards['B']).toBeUndefined();
      expect(s['left'].cards['A'].searchText).toBe('node_');
    });

    it('clears the selected metric when its query is gone', () => {
      const s = signalExplorerReducer(twoCards(), changeQueriesAction({ exploreId: 'left', queries: [query('A')] }));

      expect(s['left'].selectedMetric).toBeUndefined();
    });

    it('clears the active refId when its query is gone', () => {
      const s = signalExplorerReducer(twoCards(), changeQueriesAction({ exploreId: 'left', queries: [query('A')] }));

      expect(s['left'].activeRefId).toBeUndefined();
    });

    it('keeps everything when every refId survives', () => {
      const before = twoCards();
      const after = signalExplorerReducer(
        before,
        changeQueriesAction({ exploreId: 'left', queries: [query('A'), query('B')] })
      );

      expect(after).toEqual(before);
    });

    it('prunes on setQueries too, so a URL sync cannot leave a card behind', () => {
      const s = signalExplorerReducer(twoCards(), setQueriesAction({ exploreId: 'left', queries: [query('A')] }));

      expect(s['left'].cards['B']).toBeUndefined();
      expect(s['left'].selectedMetric).toBeUndefined();
    });

    it('leaves other panes alone', () => {
      let s = signalExplorerReducer(twoCards(), setSearchText({ exploreId: 'right', refId: 'B', searchText: 'go_' }));
      s = signalExplorerReducer(s, changeQueriesAction({ exploreId: 'left', queries: [query('A')] }));

      expect(s['right'].cards['B'].searchText).toBe('go_');
    });

    it('does not create a pane for an exploreId it has no state for', () => {
      expect(signalExplorerReducer(initial, changeQueriesAction({ exploreId: 'left', queries: [query('A')] }))).toEqual(
        initial
      );
    });

    // `changeQueries` is a thunk with the same type prefix, so its lifecycle actions are
    // `explore/changeQueries/pending` etc. — same prefix, no `queries` in the payload.
    it('ignores the thunk lifecycle actions that share the prefix but carry no queries', () => {
      const before = twoCards();

      expect(
        signalExplorerReducer(before, {
          type: changeQueries.pending.type,
          payload: undefined,
          meta: { arg: { exploreId: 'left', queries: [] }, requestId: '1', requestStatus: 'pending' },
        })
      ).toEqual(before);
    });
  });
});
