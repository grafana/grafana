import * as signalExplorer from './index';
import type {
  CardModel,
  CardViewState,
  DatasourceCardProps,
  LabelValuesBlockProps,
  MetricCatalog,
  MetricMetadataBlockProps,
  MetricRowModel,
  MetricRowProps,
  MetricTreeProps,
  MetricType,
  MetricTypeFilterProps,
  PaneViewState,
  SignalExplorerRailProps,
  SignalExplorerState,
} from './index';

/**
 * The barrel is the surface another shell builds on, and it has no importer inside Grafana — so
 * without this file, dropping an export or renaming one breaks nobody's build until it breaks
 * theirs. These assertions are the contract: adding to the list is a decision, removing from it is a
 * breaking change, and either way it happens on purpose.
 */
describe('signalExplorer public surface', () => {
  it('exports exactly the published values', () => {
    expect(Object.keys(signalExplorer).sort()).toEqual([
      'DatasourceCard',
      'INITIAL_BATCH',
      'LabelValuesBlock',
      'MetricMetadataBlock',
      'MetricRow',
      'MetricTree',
      'MetricTypeFilter',
      'SignalExplorerRail',
      'clearExploreState',
      'clearSelectedMetric',
      'deriveMetricType',
      'detectMetricsInQueries',
      'dsKey',
      'getMetricTypeBadgeColor',
      'getMetricTypeLabel',
      'getMetricTypeOptions',
      'invalidateMetricCache',
      'rangeKey',
      'resolveCards',
      'selectActiveRefId',
      'selectCardViewState',
      'selectSearchText',
      'selectSelectedMetric',
      'selectSignalExplorerState',
      'selectTypeFilter',
      'setActiveRefId',
      'setSearchText',
      'setSelectedMetric',
      'setTypeFilter',
      'signalExplorerReducer',
      'toRefsByMetric',
      'useLabelValues',
      'useMetricCatalog',
      'useMetricDetail',
      'useVisibleBatch',
    ]);
  });

  it('exports components as components and helpers as functions', () => {
    for (const name of [
      'DatasourceCard',
      'LabelValuesBlock',
      'MetricMetadataBlock',
      'MetricTree',
      'MetricTypeFilter',
      'SignalExplorerRail',
      'deriveMetricType',
      'detectMetricsInQueries',
      'dsKey',
      'getMetricTypeBadgeColor',
      'getMetricTypeLabel',
      'getMetricTypeOptions',
      'invalidateMetricCache',
      'rangeKey',
      'resolveCards',
      'toRefsByMetric',
      'useLabelValues',
      'useMetricCatalog',
      'useMetricDetail',
      'useVisibleBatch',
    ] as const) {
      expect(typeof signalExplorer[name]).toBe('function');
    }

    // `MetricRow` is wrapped in `memo`, so it is a React element type rather than a function.
    expect(signalExplorer.MetricRow).toEqual(expect.objectContaining({ type: expect.any(Function) }));
  });

  // The guarantee a host relies on: an untouched pane or card reads as unfiltered rather than as
  // absent, so nothing has to seed the slice before rendering.
  it('exports selectors that answer for a pane the slice has never seen', () => {
    const state = { signalExplorer: {} };

    expect(signalExplorer.selectSignalExplorerState(state, 'left')).toEqual({ cards: {} });
    expect(signalExplorer.selectActiveRefId(state, 'left')).toBeUndefined();
    expect(signalExplorer.selectSelectedMetric(state, 'left')).toBeUndefined();
    expect(signalExplorer.selectSearchText(state, 'left', 'A')).toBe('');
    expect(signalExplorer.selectTypeFilter(state, 'left', 'A')).toBeNull();
    expect(signalExplorer.selectCardViewState(state, 'left', 'A')).toEqual({ typeFilter: null, searchText: '' });
  });

  // A host may dispatch these by hand or assert on them in its own tests, so the strings are part of
  // the contract, not an implementation detail of `createSlice`.
  it('exports actions whose types are stable', () => {
    expect(signalExplorer.setActiveRefId.type).toBe('signalExplorer/setActiveRefId');
    expect(signalExplorer.setSelectedMetric.type).toBe('signalExplorer/setSelectedMetric');
    expect(signalExplorer.clearSelectedMetric.type).toBe('signalExplorer/clearSelectedMetric');
    expect(signalExplorer.setTypeFilter.type).toBe('signalExplorer/setTypeFilter');
    expect(signalExplorer.setSearchText.type).toBe('signalExplorer/setSearchText');
    expect(signalExplorer.clearExploreState.type).toBe('signalExplorer/clearExploreState');
  });

  it('exports a reducer that initializes itself', () => {
    expect(signalExplorer.signalExplorerReducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('exports a batch size for the lists that need one', () => {
    expect(signalExplorer.INITIAL_BATCH).toBeGreaterThan(0);
    expect(Number.isInteger(signalExplorer.INITIAL_BATCH)).toBe(true);
  });
});

/**
 * The published types, referenced so that removing one from the barrel fails `yarn typecheck`. A type
 * export leaves nothing behind at runtime, so no assertion above can see it go.
 */
export type PublishedTypes = [
  CardModel,
  CardViewState,
  DatasourceCardProps,
  LabelValuesBlockProps,
  MetricCatalog,
  MetricMetadataBlockProps,
  MetricRowModel,
  MetricRowProps,
  MetricTreeProps,
  MetricType,
  MetricTypeFilterProps,
  PaneViewState,
  SignalExplorerRailProps,
  SignalExplorerState,
];
