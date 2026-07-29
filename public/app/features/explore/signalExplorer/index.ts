/**
 * Public surface of the signal explorer's data layer.
 *
 * This module is the "what can this datasource tell us" half of the datasource explorer sidebar;
 * the UI half lives in `explore/ContentOutline/SignalExplorer/`. Nothing here renders anything, and
 * nothing here reads Explore's store, and nothing here holds a translated string — every function and
 * hook takes a `DataSourceRef` and a `TimeRange` as plain arguments, so a caller cannot reach the
 * wrong datasource by construction. That matters most in a Mixed pane, where each card resolves a
 * different one.
 *
 * Anything not listed here is an implementation detail and may change without notice. The resource
 * client is published in part, and only in part: `dsKey`, `rangeKey` and `invalidateMetricCache` are
 * contract, while its `fetch*` functions are not — a caller reaches data through the hooks, which
 * own the loading, cancellation and staleness rules that go with it.
 *
 * ## State
 *
 * Deliberately none. Nothing in here holds view state, and there is no reducer to register: which
 * card is open and what is typed in its search box are local `useState` in the components that own
 * them, because unmounting is what keeps that state honest. Explore hands out the lowest unused
 * refId when a query is added, so state that outlives its query gets inherited by the next one —
 * `SignalExplorer` collapses a card whose query is gone, which unmounts the body and takes its state
 * with it. Store-backed state would survive that and need pruning by hand.
 *
 * ## Batching is not optional
 *
 * Every list fed from here is unbounded in production: a Prometheus catalog runs to tens of thousands
 * of names and a high-cardinality label to thousands of values. `useVisibleBatch` is the shared cap
 * on how much of one reaches the DOM. Rendering a filtered catalog straight into the tree is the
 * defect this module exists to have already solved.
 */

/* eslint-disable no-barrel-files/no-barrel-files -- this file is the module's published surface, not an import shortcut; code inside the module imports from the leaf files directly */

export type { MetricRow, MetricType } from './types';

// The derivation only — a metric's type, not a label for it. Translated labels are presentation, so
// they belong to whatever renders the badge rather than shipping from here with nothing to render.
export { deriveMetricType } from './data/metricType';
export { useLabelValues } from './data/useLabelValues';
export { useMetricCatalog, type MetricCatalog } from './data/useMetricCatalog';
export { useMetricDetail } from './data/useMetricDetail';

/**
 * The identity the cache gives a request. Anything keyed off "which datasource, which range" — a
 * paging offset, a reset key, a memo — must use these rather than re-deriving them, because two refs
 * or ranges the client considers equal are served the same data: telling them apart resets state for
 * a request that never actually changed. `rangeKey` in particular is the raw range, so a refresh on
 * `now-1h` is deliberately the same key.
 *
 * `invalidateMetricCache` is the way to force fresh data before the entries expire on their own —
 * the action behind a refresh control. It drops the cached entries *and* makes every mounted hook
 * re-request. Entries also expire on their own after a few minutes, but that is a floor on staleness
 * rather than a refresh: nothing re-runs until something asks again.
 */
export { dsKey, invalidateMetricCache, rangeKey } from './data/metricResourceClient';

// `detectMetricsInQueries` produces `{ refId: metricNames[] }` and a metric row badges off
// `{ metricName: refIds[] }`; `toRefsByMetric` is the adapter between them, so it ships with them.
export { detectMetricsInQueries } from './query/detectMetricsInQueries';
export { toRefsByMetric } from './query/toRefsByMetric';

export { INITIAL_BATCH, useVisibleBatch } from './hooks/useVisibleBatch';
