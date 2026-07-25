import { css } from '@emotion/css';
import { useMemo, useState, type ChangeEvent } from 'react';

import { type DataQuery, type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Icon, Input, Text, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { useMetricCatalog } from '../data/useMetricCatalog';
import { detectMetricsInQueries } from '../query/detectMetricsInQueries';
import { toRefsByMetric } from '../query/toRefsByMetric';
import { selectSearchText, selectTypeFilter } from '../state/selectors';
import { setActiveRefId, setSearchText, setTypeFilter } from '../state/signalExplorerSlice';
import type { MetricType } from '../types';

import { MetricTree } from './MetricTree';
import { MetricTypeFilter } from './MetricTypeFilter';

export interface DatasourceCardProps {
  exploreId: string;
  refId: string;
  dsRef: DataSourceRef;
  dsName: string;
  isPrometheus: boolean;
  isActive: boolean;
  timeRange: TimeRange;
  /**
   * Every query in the pane, read-only. The card matches them against its own datasource's catalog
   * to work out which refIds already reference each metric — the host cannot do that for it,
   * because in a mixed pane every card resolves a different catalog.
   */
  paneQueries: DataQuery[];
}

/**
 * One card per query's datasource. This and `SignalExplorerRail` are the only two components that
 * know about the "one card per query" arrangement — everything below (`MetricTree` and friends) is
 * host-agnostic and takes its `dsRef`/`refId` as plain props.
 */
export function DatasourceCard({
  exploreId,
  refId,
  dsRef,
  dsName,
  isPrometheus,
  isActive,
  timeRange,
  paneQueries,
}: DatasourceCardProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  // Expansion is high-frequency, per-card UI state that nothing else reads, so it stays local
  // rather than round-tripping through the store — same precedent as MetricTree's row/label
  // expansion. Seeded from `isActive` so the card the host marks active opens expanded.
  const [isExpanded, setIsExpanded] = useState(isActive);

  // A datasource that has since been removed resolves to `undefined` here; every step past this
  // point must tolerate that instead of crashing the card.
  const logo = getDataSourceSrv().getInstanceSettings(dsRef)?.meta.info.logos.small;

  const onToggle = () => {
    setIsExpanded((current) => {
      const next = !current;
      if (next) {
        dispatch(setActiveRefId({ exploreId, refId }));
      }
      return next;
    });
  };

  const expandLabel = isExpanded
    ? t('explore.signal-explorer.card.collapse', 'Collapse {{name}}', { name: dsName })
    : t('explore.signal-explorer.card.expand', 'Expand {{name}}', { name: dsName });

  return (
    <div className={styles.card} data-testid="signal-explorer-datasource-card">
      <button
        type="button"
        className={styles.header}
        aria-expanded={isExpanded}
        aria-label={expandLabel}
        onClick={onToggle}
      >
        <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
        {logo && <img className={styles.logo} src={logo} alt="" data-testid="signal-explorer-datasource-logo" />}
        <Text weight="medium">{dsName}</Text>
      </button>
      {isExpanded && (
        <div className={styles.body} data-testid="signal-explorer-datasource-card-body">
          {isPrometheus ? (
            <PrometheusBody
              exploreId={exploreId}
              refId={refId}
              dsRef={dsRef}
              timeRange={timeRange}
              paneQueries={paneQueries}
            />
          ) : (
            <Text color="secondary">
              {t('explore.signal-explorer.card.nothing-to-browse', 'Nothing to browse for this datasource')}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}

interface PrometheusBodyProps {
  exploreId: string;
  refId: string;
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  paneQueries: DataQuery[];
}

/**
 * Split out from `DatasourceCard` so its `useMetricCatalog` call only ever runs for an expanded
 * Prometheus card — the non-Prometheus branch has nothing to browse and must not fetch a catalog
 * for a datasource that has none.
 */
function PrometheusBody({ exploreId, refId, dsRef, timeRange, paneQueries }: PrometheusBodyProps) {
  const dispatch = useDispatch();

  const searchText = useSelector((state) => selectSearchText(state, exploreId));
  const typeFilter = useSelector((state) => selectTypeFilter(state, exploreId));

  // `MetricTree` calls `useMetricCatalog` with these same arguments and renders an empty `<div>`
  // when the catalog resolves to no metrics (e.g. every search that matches nothing). Reading it
  // here too — the underlying fetch is cached by datasource+range, so this does not double the
  // network cost — is how this card supplies the empty-state message that `MetricTree` itself
  // deliberately does not own.
  const { metrics, loading, error } = useMetricCatalog(dsRef, timeRange, { typeFilter, searchText });
  const isCatalogEmpty = !loading && !error && metrics.length === 0;

  // Matching happens here rather than in the host because the answer depends on *this* card's
  // catalog: in a mixed pane every card resolves a different datasource, and the same token can be
  // a metric in one and meaningless in another. All of the pane's queries are matched, not just
  // this card's, so a metric this datasource knows is badged with every refId that references it.
  // Matching the search/type-filtered catalog rather than the whole one is enough: `MetricTree`
  // renders that same filtered list, so a name it cannot show cannot be badged either.
  const queryRefsByMetric = useMemo(
    () => toRefsByMetric(detectMetricsInQueries(paneQueries, new Set(metrics.map((metric) => metric.name)))),
    [paneQueries, metrics]
  );

  const searchLabel = t('explore.signal-explorer.card.search-metrics', 'Search metrics');

  return (
    <>
      <Input
        value={searchText}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          dispatch(setSearchText({ exploreId, searchText: event.currentTarget.value }))
        }
        placeholder={searchLabel}
        aria-label={searchLabel}
      />
      <MetricTypeFilter
        value={typeFilter}
        onChange={(value: MetricType | null) => dispatch(setTypeFilter({ exploreId, typeFilter: value }))}
      />
      <MetricTree
        exploreId={exploreId}
        refId={refId}
        dsRef={dsRef}
        timeRange={timeRange}
        queryRefsByMetric={queryRefsByMetric}
      />
      {isCatalogEmpty && (
        <Text color="secondary" variant="bodySmall">
          {t('explore.signal-explorer.card.no-metrics', 'No metrics found')}
        </Text>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(1),
    background: 'none',
    border: 'none',
    color: theme.colors.text.primary,
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  logo: css({
    width: theme.spacing(2),
    height: theme.spacing(2),
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1, 1, 1),
  }),
});
