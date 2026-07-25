/**
 * Public surface of the signal explorer.
 *
 * `SignalExplorerRail` is one arrangement of these pieces — the leaf components, hooks and state
 * below it are exported so an alternative shell can be composed from the same parts. Anything not
 * listed here (the resource client) is an implementation detail of that arrangement and may change
 * without notice.
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
