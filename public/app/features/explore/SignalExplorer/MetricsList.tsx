import { css } from '@emotion/css';
import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, FilterInput, ScrollContainer, Spinner, Text, useStyles2 } from '@grafana/ui';

import { MetricLabels } from './MetricLabels';
import { MetricRow } from './MetricRow';
import { blockId } from './blockId';
import { dsKey, rangeKey } from './data/metricResourceClient';
import { SEARCH_DEBOUNCE_MS, useMetricCatalog } from './data/useMetricCatalog';
import { useLoadMoreSentinel } from './hooks/useLoadMoreSentinel';
import { useVisibleBatch } from './hooks/useVisibleBatch';
import {
  trackSignalExplorerMetricExpanded,
  trackSignalExplorerMetricsMetadataViewed,
  trackSignalExplorerSearchPerformed,
} from './tracking';
import { type MetricSelection } from './types';

interface Props {
  /** The owning card's query, named back to the explorer so it knows whose row was selected. */
  refId: string;
  /**
   * The card's datasource, as primitives rather than a `DataSourceRef`, because this component is the
   * `memo()` boundary: the explorer above rebuilds its card descriptors on every keystroke in a query
   * editor, and a fresh ref object each time would re-render this list for a datasource that never
   * changed. The ref is assembled once below and passed down as an object from there.
   */
  dsUid?: string;
  dsType?: string;
  /** Cards on screen, reported with this list's events so stacking can be correlated with engagement. */
  stackedQueriesCount: number;
  timeRange: TimeRange;
  /** Name of the metric the detail panel is showing, if it belongs to this list. */
  selectedMetric?: string;
  /**
   * Hands over the whole catalog entry rather than the name, so the panel needs no request of its
   * own. Must be stable, or the `memo()` above stops earning its keep.
   */
  onSelectMetric: (selection: MetricSelection) => void;
}

/**
 * Searchable list of a Prometheus datasource's metric names, rendered as the body of an expanded
 * SignalCard.
 *
 * Only a batch of the list reaches the DOM at a time — a real catalog runs to tens of thousands of
 * names — and the next batch is added as the end of the list scrolls into view. Searching is the
 * catalog hook's job, not this component's: the list being searched is the whole datasource's
 * catalog, which this component never holds.
 *
 * A row's chevron expands it to its label keys and a label key to its values. One metric and one label
 * at a time: every open row holds a request open, and both lists are unbounded. The row's name is a
 * separate control, selecting the metric for the sidebar's detail panel.
 */
export const MetricsList = memo(function MetricsList({
  refId,
  dsUid,
  dsType,
  stackedQueriesCount,
  timeRange,
  selectedMetric,
  onSelectMetric,
}: Props) {
  const styles = useStyles2(getStyles);
  const [searchTerm, setSearchTerm] = useState('');

  // Per instance, because a Mixed pane renders one list per card and two cards can offer the same
  // metric name — ids derived from the name alone would be duplicated across the document.
  const listId = useId();

  // Expansion is high-frequency, unshared and worthless to persist, so it stays local. It also means
  // a card collapsing takes this state with it, which is what keeps a recycled refId from inheriting
  // the expansion of the query it replaced.
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  // Through refs, like `metricsRef` below: both callbacks consult the current value only to tell an
  // opening from a closing, and taking them as dependencies would rebuild the callbacks on every
  // expand and every selection, undoing `MetricRow`'s `memo()` for every row that did not move.
  const expandedMetricRef = useRef(expandedMetric);
  expandedMetricRef.current = expandedMetric;
  const selectedMetricRef = useRef(selectedMetric);
  selectedMetricRef.current = selectedMetric;

  const toggleMetric = useCallback(
    (name: string) => {
      // Only the opening half is an event: collapsing a row is not a metric being explored.
      if (expandedMetricRef.current !== name) {
        trackSignalExplorerMetricExpanded({
          data_source_type: dsType,
          stacked_queries_count: stackedQueriesCount,
        });
      }

      setExpandedMetric((current) => (current === name ? null : name));
      // Forget the open label too: re-expanding a metric should open collapsed rather than restore a
      // label the user closed the row on.
      setExpandedLabel(null);
    },
    [dsType, stackedQueriesCount]
  );

  const toggleLabel = useCallback((labelKey: string) => {
    setExpandedLabel((current) => (current === labelKey ? null : labelKey));
  }, []);

  // Stable across the re-renders the memo above cannot absorb, so the plain components below can take
  // a ref object without one identity change per render turning into a refetch.
  const dsRef = useMemo<DataSourceRef>(() => ({ uid: dsUid, type: dsType }), [dsUid, dsType]);
  const { metrics, loading, error } = useMetricCatalog(dsRef, timeRange, { searchText: searchTerm });

  // The last term reported. `loading` is a dependency below and rises again on every refetch — a
  // range change, a card switching datasource, an invalidation — and none of those are a search.
  const reportedTermRef = useRef<string | null>(null);

  // `FilterInput` fires per keystroke, so a term only becomes an event once the user stops typing.
  // `loading` also covers a search still waiting on the datasource, so once it drops `metrics`
  // matches `searchTerm`.
  useDebounce(
    () => {
      if (!searchTerm) {
        // An empty box is not a search, but it does arm the next one: clearing and retyping the
        // same term is a second search.
        reportedTermRef.current = null;
        return;
      }

      // A count taken mid-fetch would report zero results for a catalog that simply has not
      // arrived; `loading` is a dependency, so the term is reported once it does.
      if (loading || reportedTermRef.current === searchTerm) {
        return;
      }

      reportedTermRef.current = searchTerm;
      trackSignalExplorerSearchPerformed({
        data_source_type: dsType,
        stacked_queries_count: stackedQueriesCount,
        search_term_length: searchTerm.length,
        result_count: metrics.length,
      });
    },
    300,
    [searchTerm, loading]
  );

  // Rows are handed a name, so the entry is looked up here. Through a ref, not a dependency:
  // `metrics` is a fresh array on every keystroke, which would undo `MetricRow`'s `memo()`.
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const selectMetric = useCallback(
    (name: string) => {
      const metric = metricsRef.current.find((candidate) => candidate.name === name);
      if (metric) {
        // Re-picking the open metric closes the detail panel, which is nobody viewing metadata.
        if (selectedMetricRef.current !== name) {
          trackSignalExplorerMetricsMetadataViewed({
            data_source_type: dsType,
            stacked_queries_count: stackedQueriesCount,
          });
        }

        onSelectMetric({ refId, dsKey: dsKey(dsRef), metric });
      }
    },
    [onSelectMetric, refId, dsRef, dsType, stackedQueriesCount]
  );

  // Paging resets on anything that swaps the catalog out for a different one — the search, but also
  // the datasource and the range. An offset into the old list means nothing in the new one.
  const pagingKey = `${dsKey(dsRef)}|${rangeKey(timeRange)}|${searchTerm}`;
  const { visibleCount, showMore } = useVisibleBatch(pagingKey);
  const visible = metrics.slice(0, visibleCount);
  // While rows are showing, a line of text above them would push the list down and back on every
  // keystroke of a server-side search, so the input carries the signal instead.
  const refreshing = loading && metrics.length > 0;
  const setSentinel = useLoadMoreSentinel(showMore, visibleCount);

  // The search box sits outside the scroll region, so a new list would otherwise open at the old
  // offset: clamped near the bottom of the first batch, with the end in view loading another.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = 0;
    }
  }, [pagingKey]);

  // Rows arrive on scroll with nothing announcing them, so without this a screen reader user cannot
  // tell a list that ends from one with more to load. Silent while loading, since the counts are not
  // yet the answer, and on error, which announces itself. Named by query, because several cards can
  // be open at once and a range change reloads them all together.
  let statusText = '';
  if (!loading && !error) {
    statusText =
      metrics.length === 0
        ? t('explore.metrics-list.no-metrics-status', 'Query {{refId}}: no metrics found', { refId })
        : t('explore.metrics-list.visible-count', '', {
            refId,
            visible: visible.length,
            count: metrics.length,
            defaultValue_one: 'Query {{refId}}: showing {{visible}} of {{count}} metric',
            defaultValue_other: 'Query {{refId}}: showing {{visible}} of {{count}} metrics',
          });
  }

  // Settled before it is announced: the count moves on every keystroke and every batch of a fill,
  // and a live region speaks each change, queued behind the user's own typing echo.
  const [announcedStatus, setAnnouncedStatus] = useState('');
  useDebounce(() => setAnnouncedStatus(statusText), SEARCH_DEBOUNCE_MS, [statusText]);

  return (
    <div className={styles.wrapper}>
      <FilterInput
        value={searchTerm}
        onChange={setSearchTerm}
        escapeRegex={false}
        placeholder={t('explore.metrics-list.search-placeholder', 'Search metrics')}
        suffix={refreshing ? <Spinner inline /> : undefined}
      />
      {loading && !refreshing && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.metrics-list.loading', 'Loading metrics…')}
        </Text>
      )}
      {/* `role="alert"` because the block appears in place of the loading text, with nothing focused
          and no other cue that the list the user was waiting for is not coming. */}
      {error && (
        <Text color="error" variant="bodySmall" role="alert">
          {t('explore.metrics-list.error', 'Failed to load metrics')}: {error.message}
        </Text>
      )}
      {!loading && !error && metrics.length === 0 && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.metrics-list.no-metrics', 'No metrics found')}
        </Text>
      )}
      <ScrollContainer ref={scrollerRef}>
        {/* Only once there is a row to put in it: an empty list is still announced as a list. */}
        {visible.length > 0 && (
          <ul className={styles.list}>
            {visible.map((metric) => {
              const expanded = metric.name === expandedMetric;
              const labelsId = blockId(listId, 'labels', metric.name);

              return (
                <li key={metric.name}>
                  <MetricRow
                    name={metric.name}
                    expanded={expanded}
                    selected={metric.name === selectedMetric}
                    labelsId={labelsId}
                    onToggle={toggleMetric}
                    onSelect={selectMetric}
                  />
                  {expanded && (
                    <MetricLabels
                      id={labelsId}
                      dsRef={dsRef}
                      timeRange={timeRange}
                      metric={metric.name}
                      expandedLabel={expandedLabel}
                      onToggleLabel={toggleLabel}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {/* Inside the scroll region on purpose: it marks the end of the list, not of the card. */}
        {metrics.length > visible.length && (
          <div ref={setSentinel} className={styles.sentinel} data-testid="signal-explorer-load-more" />
        )}
      </ScrollContainer>
      {/* Always mounted, because a live region inserted along with its text is often not announced. */}
      <div className="sr-only" role="status">
        {announcedStatus}
      </div>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'metrics-list',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: 0,
      gap: theme.spacing(1),
      padding: theme.spacing(1, 1, 1, 1.5),
    }),
    list: css({
      label: 'metrics-list-items',
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    sentinel: css({
      label: 'metrics-list-sentinel',
      // A zero-area target reports unreliable intersection ratios.
      height: 1,
      flexShrink: 0,
    }),
  };
};
