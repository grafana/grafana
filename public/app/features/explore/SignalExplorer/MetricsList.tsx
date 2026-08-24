import { css } from '@emotion/css';
import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';

import { type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, FilterInput, ScrollContainer, Text, useStyles2 } from '@grafana/ui';

import { MetricLabels } from './MetricLabels';
import { MetricRow } from './MetricRow';
import { blockId } from './blockId';
import { dsKey, rangeKey } from './data/metricResourceClient';
import { useMetricCatalog } from './data/useMetricCatalog';
import { useVisibleBatch } from './hooks/useVisibleBatch';
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
 * names. Searching is the catalog hook's job, not this component's: the list being searched is the
 * whole datasource's catalog, which this component never holds.
 *
 * A row's chevron expands it to its label keys and a label key to its values. One metric and one label
 * at a time: every open row holds a request open, and both lists are unbounded. The row's name is a
 * separate control, selecting the metric for the sidebar's detail panel.
 */
export const MetricsList = memo(function MetricsList({
  refId,
  dsUid,
  dsType,
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

  const toggleMetric = useCallback((name: string) => {
    setExpandedMetric((current) => (current === name ? null : name));
    // Forget the open label too: re-expanding a metric should open collapsed rather than restore a
    // label the user closed the row on.
    setExpandedLabel(null);
  }, []);

  const toggleLabel = useCallback((labelKey: string) => {
    setExpandedLabel((current) => (current === labelKey ? null : labelKey));
  }, []);

  // Stable across the re-renders the memo above cannot absorb, so the plain components below can take
  // a ref object without one identity change per render turning into a refetch.
  const dsRef = useMemo<DataSourceRef>(() => ({ uid: dsUid, type: dsType }), [dsUid, dsType]);
  const { metrics, loading, error } = useMetricCatalog(dsRef, timeRange, { searchText: searchTerm });

  // Rows are handed a name, so the entry is looked up here. Through a ref, not a dependency:
  // `metrics` is a fresh array on every keystroke, which would undo `MetricRow`'s `memo()`.
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const selectMetric = useCallback(
    (name: string) => {
      const metric = metricsRef.current.find((candidate) => candidate.name === name);
      if (metric) {
        onSelectMetric({ refId, dsUid, metric });
      }
    },
    [onSelectMetric, refId, dsUid]
  );

  // Paging resets on anything that swaps the catalog out for a different one — the search, but also
  // the datasource and the range. An offset into the old list means nothing in the new one.
  const { visibleCount, showMore } = useVisibleBatch(`${dsKey(dsRef)}|${rangeKey(timeRange)}|${searchTerm}`);
  const visible = metrics.slice(0, visibleCount);

  return (
    <div className={styles.wrapper}>
      <FilterInput
        value={searchTerm}
        onChange={setSearchTerm}
        escapeRegex={false}
        placeholder={t('explore.metrics-list.search-placeholder', 'Search metrics')}
      />
      {loading && (
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
      <ScrollContainer>
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
        {/* Inside the scroll region on purpose: it belongs to the end of the list, not to the card. */}
        {metrics.length > visible.length && (
          <Button
            className={styles.showMore}
            size="sm"
            variant="secondary"
            fill="text"
            aria-label={t('explore.metrics-list.show-more-metrics', 'Show more metrics')}
            onClick={showMore}
          >
            {t('explore.metrics-list.show-more', 'Show more')}
          </Button>
        )}
      </ScrollContainer>
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
    showMore: css({
      label: 'metrics-list-show-more',
      alignSelf: 'flex-start',
    }),
  };
};
