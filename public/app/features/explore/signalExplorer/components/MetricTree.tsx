import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type DataQuery, type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Text, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useMetricCatalog } from '../data/useMetricCatalog';
import { useMetricDetail } from '../data/useMetricDetail';
import { detectMetricsInQueries } from '../query/detectMetricsInQueries';
import { toRefsByMetric } from '../query/toRefsByMetric';
import { selectSearchText, selectSelectedMetric, selectTypeFilter } from '../state/selectors';
import { setSelectedMetric } from '../state/signalExplorerSlice';

import { LabelValuesBlock } from './LabelValuesBlock';
import { MetricRow } from './MetricRow';
import { useVisibleBatch } from './useVisibleBatch';

const NO_BADGES: string[] = [];
const NO_QUERIES: DataQuery[] = [];

export interface MetricTreeProps {
  exploreId: string;
  refId: string;
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  /**
   * Queries whose refIds may badge these metrics — the pane's queries that run against *this*
   * datasource. Matching happens here rather than in the host because the answer depends on this
   * datasource's catalog: in a mixed pane every card resolves a different one, and the same token
   * can be a metric in one and meaningless in another.
   */
  matchQueries?: DataQuery[];
}

export function MetricTree({ exploreId, refId, dsRef, timeRange, matchQueries = NO_QUERIES }: MetricTreeProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const searchText = useSelector((state) => selectSearchText(state, exploreId, refId));
  const typeFilter = useSelector((state) => selectTypeFilter(state, exploreId, refId));
  const selectedMetric = useSelector((state) => selectSelectedMetric(state, exploreId));

  // Expansion is high-frequency, unshared and worthless to persist, so it stays local instead of
  // round-tripping through the store.
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);

  const { metrics, loading, error } = useMetricCatalog(dsRef, timeRange, { typeFilter, searchText });

  // Matching the search/type-filtered catalog rather than the whole one is enough: only the names
  // rendered below can be badged anyway.
  const queryRefsByMetric = useMemo(
    () => toRefsByMetric(detectMetricsInQueries(matchQueries, new Set(metrics.map((metric) => metric.name)))),
    [matchQueries, metrics]
  );

  const sortedMetrics = useMemo(() => {
    const isUsed = (name: string) => (queryRefsByMetric[name]?.length ?? 0) > 0;
    // Array.prototype.sort is stable, so metrics that are equally (un)used keep the catalog order.
    return [...metrics].sort((a, b) => Number(isUsed(b.name)) - Number(isUsed(a.name)));
  }, [metrics, queryRefsByMetric]);

  // A real catalog holds tens of thousands of names, so only a batch of them is rendered.
  const { visibleCount, showMore } = useVisibleBatch(`${searchText}|${typeFilter ?? ''}`);
  const visibleMetrics = sortedMetrics.slice(0, visibleCount);

  // Stable identities, so the memoized rows below actually re-use their previous render. Both take
  // the metric name rather than closing over it, which is what lets them be hoisted out of the map.
  const selectMetric = useCallback(
    (metricName: string) => dispatch(setSelectedMetric({ exploreId, refId, metricName })),
    [dispatch, exploreId, refId]
  );

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
      {!loading && !error && metrics.length === 0 && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.signal-explorer.tree.no-metrics', 'No metrics found')}
        </Text>
      )}
      {visibleMetrics.map((metric) => {
        const isExpanded = metric.name === expandedMetric;
        return (
          <div key={metric.name}>
            <MetricRow
              metric={metric}
              refBadges={queryRefsByMetric[metric.name] ?? NO_BADGES}
              selected={selectedMetric?.refId === refId && selectedMetric.metricName === metric.name}
              expanded={isExpanded}
              onSelect={selectMetric}
              onToggleExpand={toggleMetric}
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
      {sortedMetrics.length > visibleMetrics.length && (
        <Button className={styles.showMore} size="sm" variant="secondary" fill="text" onClick={showMore}>
          {t('explore.signal-explorer.tree.show-more', 'Show more')}
        </Button>
      )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  tree: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  showMore: css({
    alignSelf: 'flex-start',
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
});
