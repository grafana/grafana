import { css } from '@emotion/css';
import { useCallback, useMemo, useState, type ChangeEvent } from 'react';

import { type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, IconButton, Input, Text, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useLabelValues } from '../data/useLabelValues';
import { useMetricCatalog } from '../data/useMetricCatalog';
import { useMetricDetail } from '../data/useMetricDetail';
import { selectSearchText, selectSelectedMetric, selectTypeFilter } from '../state/selectors';
import { setSelectedMetric } from '../state/signalExplorerSlice';

import { MetricRow } from './MetricRow';

/** How many label values reach the DOM at a time, and how many each "show more" adds. */
const INITIAL_BATCH = 25;

const NO_BADGES: string[] = [];

// A single reused collator rather than per-comparison `localeCompare`: a high-cardinality label
// can hold thousands of values, and this comparator runs across all of them on every reorder.
const valueCollator = new Intl.Collator();

export interface MetricTreeProps {
  exploreId: string;
  refId: string;
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  /** Metric name -> refIds of the queries in this pane that already reference it. */
  queryRefsByMetric?: Record<string, string[]>;
}

export function MetricTree({ exploreId, refId, dsRef, timeRange, queryRefsByMetric }: MetricTreeProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const searchText = useSelector((state) => selectSearchText(state, exploreId));
  const typeFilter = useSelector((state) => selectTypeFilter(state, exploreId));
  const selectedMetric = useSelector((state) => selectSelectedMetric(state, exploreId));

  // Expansion is high-frequency, unshared and worthless to persist, so it stays local instead of
  // round-tripping through the store.
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  const { metrics, loading, error } = useMetricCatalog(dsRef, timeRange, { typeFilter, searchText });

  const sortedMetrics = useMemo(() => {
    const isUsed = (name: string) => (queryRefsByMetric?.[name]?.length ?? 0) > 0;
    // Array.prototype.sort is stable, so metrics that are equally (un)used keep the catalog order.
    return [...metrics].sort((a, b) => Number(isUsed(b.name)) - Number(isUsed(a.name)));
  }, [metrics, queryRefsByMetric]);

  const toggleMetric = useCallback((name: string) => {
    setExpandedMetric((current) => (current === name ? null : name));
    setExpandedLabel(null);
  }, []);

  const toggleLabel = useCallback((labelKey: string) => {
    setExpandedLabel((current) => (current === labelKey ? null : labelKey));
  }, []);

  return (
    <div className={styles.tree}>
      {loading && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.signal-explorer.tree.loading-metrics', 'Loading metrics…')}
        </Text>
      )}
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.signal-explorer.tree.metrics-error', 'Failed to load metrics')}
        </Text>
      )}
      {sortedMetrics.map((metric) => {
        const isExpanded = metric.name === expandedMetric;
        return (
          <div key={metric.name}>
            <MetricRow
              metric={metric}
              refBadges={queryRefsByMetric?.[metric.name] ?? NO_BADGES}
              selected={selectedMetric?.refId === refId && selectedMetric.metricName === metric.name}
              expanded={isExpanded}
              onSelect={() => dispatch(setSelectedMetric({ exploreId, refId, metricName: metric.name }))}
              onToggleExpand={() => toggleMetric(metric.name)}
            />
            {isExpanded && (
              <MetricLabelsBlock
                dsRef={dsRef}
                timeRange={timeRange}
                metric={metric.name}
                expandedLabel={expandedLabel}
                onToggleLabel={toggleLabel}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MetricLabelsBlockProps {
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  metric: string;
  expandedLabel: string | null;
  onToggleLabel: (labelKey: string) => void;
}

/**
 * Label keys of one expanded metric. Mounted only while that row is expanded — the laziness comes
 * from mounting, which is also what keeps `useMetricDetail` out of a render loop over the rows.
 */
function MetricLabelsBlock({ dsRef, timeRange, metric, expandedLabel, onToggleLabel }: MetricLabelsBlockProps) {
  const styles = useStyles2(getStyles);
  const { labelKeys, loading, error } = useMetricDetail(dsRef, timeRange, metric, true);

  return (
    <div className={styles.labelsBlock}>
      {loading && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.signal-explorer.tree.loading-labels', 'Loading labels…')}
        </Text>
      )}
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.signal-explorer.tree.labels-error', 'Failed to load labels')}
        </Text>
      )}
      {labelKeys.map((labelKey) => {
        const isLabelExpanded = labelKey === expandedLabel;
        return (
          <div key={labelKey}>
            <button
              type="button"
              className={styles.labelRow}
              aria-expanded={isLabelExpanded}
              aria-label={
                isLabelExpanded
                  ? t('explore.signal-explorer.tree.hide-values', 'Hide values for {{label}}', { label: labelKey })
                  : t('explore.signal-explorer.tree.show-values', 'Show values for {{label}}', { label: labelKey })
              }
              onClick={() => onToggleLabel(labelKey)}
            >
              <Icon name={isLabelExpanded ? 'angle-down' : 'angle-right'} />
              {labelKey}
            </button>
            {isLabelExpanded && (
              <LabelValuesBlock dsRef={dsRef} timeRange={timeRange} metric={metric} labelKey={labelKey} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface LabelValuesBlockProps {
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  metric: string;
  labelKey: string;
}

/**
 * Values of one expanded label key. Mounted only while that label is expanded, and renders at most
 * one batch at a time: a high-cardinality label can hold thousands of values.
 */
function LabelValuesBlock({ dsRef, timeRange, metric, labelKey }: LabelValuesBlockProps) {
  const styles = useStyles2(getStyles);
  const { values, loading, error } = useLabelValues(dsRef, timeRange, metric, labelKey, true);

  const [filter, setFilter] = useState('');
  const [ascending, setAscending] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);

  const ordered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const matching = needle ? values.filter((value) => value.toLowerCase().includes(needle)) : values;
    return [...matching].sort((a, b) => (ascending ? valueCollator.compare(a, b) : valueCollator.compare(b, a)));
  }, [values, filter, ascending]);

  // Slice before mapping: hiding the overflow with CSS would still put thousands of nodes in the DOM.
  const visible = ordered.slice(0, visibleCount);

  const onFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFilter(event.currentTarget.value);
    // Reset paging with the filter: keeping a grown offset would show a batch of a list the user
    // never paged through.
    setVisibleCount(INITIAL_BATCH);
  };

  const filterLabel = t('explore.signal-explorer.tree.filter-values', 'Filter values');

  return (
    <div className={styles.valuesBlock}>
      <div className={styles.valuesToolbar}>
        <Input value={filter} onChange={onFilterChange} aria-label={filterLabel} placeholder={filterLabel} />
        <IconButton
          name={ascending ? 'sort-amount-up' : 'sort-amount-down'}
          aria-label={
            ascending
              ? t('explore.signal-explorer.tree.sort-descending', 'Sort descending')
              : t('explore.signal-explorer.tree.sort-ascending', 'Sort ascending')
          }
          onClick={() => setAscending((current) => !current)}
        />
      </div>
      {loading && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.signal-explorer.tree.loading-values', 'Loading values…')}
        </Text>
      )}
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.signal-explorer.tree.values-error', 'Failed to load values')}
        </Text>
      )}
      {visible.map((value) => (
        <div key={value} className={styles.valueRow} data-testid="signal-explorer-value-row">
          {value}
        </div>
      ))}
      {ordered.length > visible.length && (
        <Button
          size="sm"
          variant="secondary"
          fill="text"
          onClick={() => setVisibleCount((count) => count + INITIAL_BATCH)}
        >
          {t('explore.signal-explorer.tree.show-more', 'Show more')}
        </Button>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tree: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  labelsBlock: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    marginLeft: theme.spacing(2),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  labelRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.radius.default,
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  valuesBlock: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.25),
    marginLeft: theme.spacing(2),
    paddingLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
  valuesToolbar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.5, 0),
  }),
  valueRow: css({
    overflow: 'hidden',
    maxWidth: '100%',
    padding: theme.spacing(0, 0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
