/**
 * Public surface of the signal explorer.
 *
 * `SignalExplorerRail` is one arrangement of these pieces — the leaf components, hooks and state
 * below it are exported so an alternative shell can be composed from the same parts. Anything not
 * listed here is an implementation detail of that arrangement and may change without notice; the
 * resource client is published in part, and only in part: `dsKey`, `rangeKey` and
 * `invalidateMetricCache` are contract, while its `fetch*` functions are not — a host reaches data
 * through the hooks, which own the loading and cancellation rules that go with it.
 *
 * ## Shared state
 *
 * Lives at `state.signalExplorer[exploreId]` — a top-level store key, NOT nested under `explore`,
 * because `exploreReducer` is hand-written and routes any action carrying an `exploreId` into the
 * pane reducers.
 *
 * Per pane: `activeRefId` and `selectedMetric`. These are the genuinely cross-card concepts — which
 * card is active, and which metric the one shared metadata block is describing.
 *
 * Per card: `cards[refId].searchText` and `cards[refId].typeFilter`, so `selectSearchText` and
 * `selectTypeFilter` take `(state, exploreId, refId)` while the pane-level selectors take
 * `(state, exploreId)`. They are per-card because nothing constrains a pane to one open card: a
 * mixed pane with two Prometheus queries shows two trees at once, and one pane-wide search box
 * would re-filter both from whichever one was typed in. A card that has never been touched reads
 * as unfiltered rather than absent, so a host need not seed the slice before rendering.
 *
 * Deliberately NOT here: a row's or label's own expand/collapse. That is local `useState` in
 * `MetricTree`, because mounting is what makes the label and value fetches lazy — a collapsed row
 * cannot fetch even by accident.
 */

/* eslint-disable no-barrel-files/no-barrel-files -- this file is the module's published surface, not an import shortcut; code inside the module imports from the leaf files directly */

// `MetricRow` the data shape is aliased so the `MetricRow` component keeps its own name here.
export type { MetricRow as MetricRowModel, MetricType } from './types';

export { deriveMetricType, getMetricTypeLabel, getMetricTypeOptions } from './data/metricType';
export { useLabelValues } from './data/useLabelValues';
export { useMetricCatalog } from './data/useMetricCatalog';
export { useMetricDetail } from './data/useMetricDetail';

/**
 * The identity the cache gives a request. Anything keyed off "which datasource, which range" — a
 * paging offset, a reset key, a memo — must use these rather than re-deriving them, because two refs
 * or ranges the client considers equal are served the same data: telling them apart resets state for
 * a request that never actually changed. `rangeKey` in particular is the raw range, so a refresh on
 * `now-1h` is deliberately the same key.
 *
 * `invalidateMetricCache` is the way to force fresh data before the entries expire on their own —
 * the action behind a shell's refresh control. It drops the cached entries *and* makes every mounted
 * hook re-request; entries also expire by themselves after `CACHE_TTL_MS`.
 */
export { dsKey, invalidateMetricCache, rangeKey } from './data/metricResourceClient';

// `detectMetricsInQueries` produces `{ refId: metricNames[] }` and the metric rows badge off
// `{ metricName: refIds[] }`; `toRefsByMetric` is the adapter between them, so it ships with them.
export { detectMetricsInQueries } from './query/detectMetricsInQueries';
export { toRefsByMetric } from './query/toRefsByMetric';
export { resolveCards, type CardModel } from './query/resolveCards';

export {
  clearExploreState,
  clearSelectedMetric,
  setActiveRefId,
  setSearchText,
  setSelectedMetric,
  setTypeFilter,
  signalExplorerReducer,
  type CardViewState,
  type PaneViewState,
  type SignalExplorerState,
} from './state/signalExplorerSlice';
export {
  selectActiveRefId,
  selectCardViewState,
  selectSearchText,
  selectSelectedMetric,
  selectSignalExplorerState,
  selectTypeFilter,
} from './state/selectors';

export { DatasourceCard, type DatasourceCardProps } from './components/DatasourceCard';
export { LabelValuesBlock, type LabelValuesBlockProps } from './components/LabelValuesBlock';
export { MetricRow, type MetricRowProps } from './components/MetricRow';
export { MetricTree, type MetricTreeProps } from './components/MetricTree';
export { SignalExplorerRail, type SignalExplorerRailProps } from './components/SignalExplorerRail';

// `getMetricTypeBadgeColor` ships with the block that uses it: the colours are not arbitrary, each
// one was measured against the foreground `getContrastText` derives from it so the badge clears
// WCAG AA in both themes. A second, hand-picked palette elsewhere would not.
export {
  MetricMetadataBlock,
  getMetricTypeBadgeColor,
  type MetricMetadataBlockProps,
} from './components/MetricMetadataBlock';

/**
 * Every list here is fed by a Prometheus resource call and so is unbounded in production — a catalog
 * runs to tens of thousands of names. Capping what reaches the DOM is a requirement, not a
 * refinement, and this is the shared implementation of it: a host building its own list uses this
 * rather than deciding again how much to render.
 */
export { INITIAL_BATCH, useVisibleBatch } from './components/useVisibleBatch';

/**
 * Exported without a consumer inside this module, deliberately. The card's own type filter was
 * removed from the design, but `cards[refId].typeFilter` and `useMetricCatalog`'s `typeFilter` option
 * both remain, so this is the control for them wherever a shell decides that filter belongs. It is
 * not dead code awaiting deletion.
 */
export { MetricTypeFilter, type MetricTypeFilterProps } from './components/MetricTypeFilter';
