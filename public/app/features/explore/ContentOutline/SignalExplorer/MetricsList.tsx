import { css } from '@emotion/css';
import { memo, useState } from 'react';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, FilterInput, ScrollContainer, Text, useStyles2 } from '@grafana/ui';

import { dsKey, rangeKey, useMetricCatalog, useVisibleBatch } from '../../signalExplorer';

interface Props {
  /**
   * The card's datasource, as primitives rather than a `DataSourceRef`, so this component keeps the
   * `memo()` below: the explorer above rebuilds its card descriptors on every keystroke in a query
   * editor, and a fresh ref object each time would re-render this list for a datasource that never
   * changed.
   */
  dsUid?: string;
  dsType?: string;
  timeRange: TimeRange;
}

/**
 * Searchable list of a Prometheus datasource's metric names, rendered as the body of an expanded
 * SignalCard.
 *
 * Only a batch of the list reaches the DOM at a time — a real catalog runs to tens of thousands of
 * names. Searching is the catalog hook's job, not this component's: the list being searched is the
 * whole datasource's catalog, which this component never holds.
 */
export const MetricsList = memo(function MetricsList({ dsUid, dsType, timeRange }: Props) {
  const styles = useStyles2(getStyles);
  const [searchTerm, setSearchTerm] = useState('');

  const dsRef = { uid: dsUid, type: dsType };
  const { metrics, loading, error } = useMetricCatalog(dsRef, timeRange, { searchText: searchTerm });

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
      {error && (
        <Text color="error" variant="bodySmall">
          {t('explore.metrics-list.error', 'Failed to load metrics')}
        </Text>
      )}
      {!loading && !error && metrics.length === 0 && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.metrics-list.no-metrics', 'No metrics found')}
        </Text>
      )}
      <ScrollContainer>
        <ul className={styles.list}>
          {visible.map((metric) => (
            <li key={metric.name} className={styles.listItem} title={metric.name}>
              {metric.name}
            </li>
          ))}
        </ul>
        {/* Inside the scroll region on purpose: it belongs to the end of the list, not to the card. */}
        {metrics.length > visible.length && (
          <Button className={styles.showMore} size="sm" variant="secondary" fill="text" onClick={showMore}>
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
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    listItem: css({
      display: 'block',
      padding: theme.spacing(0.5, 0.5),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.primary,
      },
    }),
    showMore: css({
      alignSelf: 'flex-start',
    }),
  };
};
