import {
  signalExplorerReducer,
  setSelectedMetric,
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
    let s = signalExplorerReducer(initial, setTypeFilter({ exploreId: 'left', typeFilter: 'counter' }));
    s = signalExplorerReducer(s, setActiveRefId({ exploreId: 'left', refId: 'A' }));
    expect(s['left'].typeFilter).toBe('counter');
    expect(s['left'].activeRefId).toBe('A');
  });
  it('clears one exploreId', () => {
    const s1 = signalExplorerReducer(initial, setActiveRefId({ exploreId: 'left', refId: 'A' }));
    const s2 = signalExplorerReducer(s1, clearExploreState({ exploreId: 'left' }));
    expect(s2['left']).toBeUndefined();
  });
});
