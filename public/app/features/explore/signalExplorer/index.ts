/**
 * Public surface of the signal explorer.
 *
 * `SignalExplorerRail` is one arrangement of these pieces — the leaf components, hooks and state
 * below it are exported so an alternative shell can be composed from the same parts. Anything not
 * listed here (the resource client) is an implementation detail of that arrangement and may change
 * without notice.
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

export { deriveMetricType, getMetricTypeOptions } from './data/metricType';
export { useLabelValues } from './data/useLabelValues';
export { useMetricCatalog } from './data/useMetricCatalog';
export { useMetricDetail } from './data/useMetricDetail';

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
export { MetricMetadataBlock, type MetricMetadataBlockProps } from './components/MetricMetadataBlock';
export { MetricRow, type MetricRowProps } from './components/MetricRow';
export { MetricTree, type MetricTreeProps } from './components/MetricTree';
export { MetricTypeFilter, type MetricTypeFilterProps } from './components/MetricTypeFilter';
export { SignalExplorerRail, type SignalExplorerRailProps } from './components/SignalExplorerRail';
