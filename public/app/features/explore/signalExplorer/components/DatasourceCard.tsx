import { css } from '@emotion/css';
import { useState, type ChangeEvent } from 'react';
import { useDebounce } from 'react-use';

import { type DataQuery, type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Icon, Input, Text, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { selectSearchText, selectTypeFilter } from '../state/selectors';
import { setActiveRefId, setSearchText, setTypeFilter } from '../state/signalExplorerSlice';
import type { MetricType } from '../types';

import { MetricTree } from './MetricTree';
import { MetricTypeFilter } from './MetricTypeFilter';

/** Long enough to swallow a burst of typing, short enough that the list still feels live. */
const SEARCH_DEBOUNCE_MS = 250;

export interface DatasourceCardProps {
  exploreId: string;
  refId: string;
  dsRef: DataSourceRef;
  dsName: string;
  isPrometheus: boolean;
  isActive: boolean;
  timeRange: TimeRange;
  /**
   * The pane's queries that run against this card's datasource, read-only. Scoped by the host
   * rather than filtered here: only the host knows how each query's datasource resolved. A metric
   * name means nothing outside its own datasource, so matching a Loki query against a Prometheus
   * catalog would badge refIds onto metrics that query never mentions.
   */
  matchQueries: DataQuery[];
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
  matchQueries,
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
              matchQueries={matchQueries}
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
  matchQueries: DataQuery[];
}

/**
 * Split out from `DatasourceCard` so nothing below it — the search box's own state, the tree, the
 * catalog fetch it triggers — exists for a collapsed card or for a datasource that has no catalog
 * to browse in the first place.
 */
function PrometheusBody({ exploreId, refId, dsRef, timeRange, matchQueries }: PrometheusBodyProps) {
  const dispatch = useDispatch();

  const searchText = useSelector((state) => selectSearchText(state, exploreId));
  const typeFilter = useSelector((state) => selectTypeFilter(state, exploreId));

  // The input keeps its own value and the store only hears about it once typing pauses: every
  // dispatch re-filters and re-sorts the whole catalog in `MetricTree`, which is far too much work
  // to do per keystroke on a catalog with tens of thousands of names.
  const [draftSearch, setDraftSearch] = useState(searchText);
  const [dispatchedSearch, setDispatchedSearch] = useState(searchText);
  if (searchText !== dispatchedSearch) {
    // The store moved without us (another card sharing this pane's `searchText`, or a reset) —
    // adopt it rather than let the input drift away from the list it is filtering.
    setDispatchedSearch(searchText);
    setDraftSearch(searchText);
  }

  useDebounce(
    () => {
      if (draftSearch !== searchText) {
        setDispatchedSearch(draftSearch);
        dispatch(setSearchText({ exploreId, searchText: draftSearch }));
      }
    },
    SEARCH_DEBOUNCE_MS,
    [draftSearch]
  );

  const searchLabel = t('explore.signal-explorer.card.search-metrics', 'Search metrics');

  return (
    <>
      <Input
        value={draftSearch}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftSearch(event.currentTarget.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
      />
      <MetricTypeFilter
        value={typeFilter}
        onChange={(value: MetricType | null) => dispatch(setTypeFilter({ exploreId, typeFilter: value }))}
      />
      <MetricTree exploreId={exploreId} refId={refId} dsRef={dsRef} timeRange={timeRange} matchQueries={matchQueries} />
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
