import { type StoreState } from 'app/types/store';

import { selectSelectedMetric, selectSignalExplorerState } from './selectors';
import { setSelectedMetric, signalExplorerReducer } from './signalExplorerSlice';

const buildState = (signalExplorer: ReturnType<typeof signalExplorerReducer>): Pick<StoreState, 'signalExplorer'> => ({
  signalExplorer,
});

describe('signalExplorer selectors', () => {
  it('returns the same reference for a missing pane across calls', () => {
    const state = buildState(signalExplorerReducer(undefined, { type: '@@INIT' }));
    const first = selectSignalExplorerState(state, 'missing');
    const second = selectSignalExplorerState(state, 'missing');
    expect(first).toBe(second);
  });

  it('falls back to typeFilter: null and searchText: "" for a missing pane', () => {
    const state = buildState(signalExplorerReducer(undefined, { type: '@@INIT' }));
    expect(selectSignalExplorerState(state, 'missing')).toEqual({ typeFilter: null, searchText: '' });
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
