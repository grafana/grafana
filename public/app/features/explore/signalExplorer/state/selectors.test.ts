import { type StoreState } from 'app/types/store';

import {
  selectCardViewState,
  selectSearchText,
  selectSelectedMetric,
  selectSignalExplorerState,
  selectTypeFilter,
} from './selectors';
import { setSearchText, setSelectedMetric, setTypeFilter, signalExplorerReducer } from './signalExplorerSlice';

const buildState = (signalExplorer: ReturnType<typeof signalExplorerReducer>): Pick<StoreState, 'signalExplorer'> => ({
  signalExplorer,
});

const emptyState = () => buildState(signalExplorerReducer(undefined, { type: '@@INIT' }));

describe('signalExplorer selectors', () => {
  it('returns the same reference for a missing pane across calls', () => {
    const state = emptyState();
    const first = selectSignalExplorerState(state, 'missing');
    const second = selectSignalExplorerState(state, 'missing');
    expect(first).toBe(second);
  });

  it('falls back to a pane with no cards', () => {
    expect(selectSignalExplorerState(emptyState(), 'missing')).toEqual({ cards: {} });
  });

  it('returns the same reference for a missing card across calls', () => {
    const state = emptyState();
    expect(selectCardViewState(state, 'left', 'A')).toBe(selectCardViewState(state, 'left', 'A'));
  });

  it('falls back to typeFilter: null and searchText: "" for a card that has never been touched', () => {
    const state = buildState(
      signalExplorerReducer(undefined, setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }))
    );

    expect(selectCardViewState(state, 'left', 'B')).toEqual({ typeFilter: null, searchText: '' });
    expect(selectSearchText(state, 'left', 'B')).toBe('');
    expect(selectTypeFilter(state, 'left', 'B')).toBeNull();
  });

  it('reads each card’s own search text and type filter', () => {
    let reduced = signalExplorerReducer(
      undefined,
      setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' })
    );
    reduced = signalExplorerReducer(reduced, setTypeFilter({ exploreId: 'left', refId: 'B', typeFilter: 'counter' }));
    const state = buildState(reduced);

    expect(selectSearchText(state, 'left', 'A')).toBe('node_');
    expect(selectSearchText(state, 'left', 'B')).toBe('');
    expect(selectTypeFilter(state, 'left', 'A')).toBeNull();
    expect(selectTypeFilter(state, 'left', 'B')).toBe('counter');
  });

  it('reads a populated pane through a selector', () => {
    const reduced = signalExplorerReducer(
      undefined,
      setSelectedMetric({ exploreId: 'left', refId: 'A', metricName: 'up' })
    );
    const state = buildState(reduced);
    expect(selectSelectedMetric(state, 'left')).toEqual({ refId: 'A', metricName: 'up' });
  });
});
