import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  matchPluginId,
  type DataQuery,
  type DataSourceApi,
  type DataSourceRef,
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { selectPanes } from '../../state/selectors';
import { useMetricCatalog } from '../data/useMetricCatalog';
import { selectActiveRefId, selectSelectedMetric } from '../state/selectors';
import { clearSelectedMetric } from '../state/signalExplorerSlice';

import { DatasourceCard } from './DatasourceCard';
import { MetricMetadataBlock } from './MetricMetadataBlock';

export interface SignalExplorerRailProps {
  exploreId: string;
}

/**
 * The sidebar shell: one `DatasourceCard` per query in the pane, plus a docked metadata block for
 * whatever the user selected. This and `DatasourceCard` are the only components that know about the
 * "one card per query" arrangement — everything below them takes its `dsRef`/`refId` as plain
 * props, so an alternative shell can be composed from the same pieces without touching them.
 */
export function SignalExplorerRail({ exploreId }: SignalExplorerRailProps) {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const pane = useSelector((state) => selectPanes(state)[exploreId]);
  const activeRefId = useSelector((state) => selectActiveRefId(state, exploreId));
  const selectedMetric = useSelector((state) => selectSelectedMetric(state, exploreId));

  const queries = pane?.queries;
  const datasourceInstance = pane?.datasourceInstance;
  const cards = useMemo(() => resolveCards(queries, datasourceInstance), [queries, datasourceInstance]);

  const selectedCard = cards.find((card) => card.refId === selectedMetric?.refId);
  const onCloseMetadata = () => dispatch(clearSelectedMetric({ exploreId }));

  if (!pane) {
    return null;
  }

  const unknownDatasource = t('explore.signal-explorer.rail.unknown-datasource', 'Unknown datasource');

  return (
    <div className={styles.rail} data-testid="signal-explorer-rail">
      <div className={styles.cards}>
        {cards.map((card) => (
          <DatasourceCard
            key={card.refId}
            exploreId={exploreId}
            refId={card.refId}
            dsRef={card.dsRef}
            dsName={card.dsName ?? unknownDatasource}
            isPrometheus={card.isPrometheus}
            isActive={card.refId === activeRefId}
            timeRange={pane.range}
            paneQueries={pane.queries}
          />
        ))}
      </div>
      <div className={styles.dock}>
        {selectedMetric && selectedCard?.isPrometheus ? (
          <SelectedMetricMetadata
            dsRef={selectedCard.dsRef}
            timeRange={pane.range}
            metricName={selectedMetric.metricName}
            onClose={onCloseMetadata}
          />
        ) : (
          <MetricMetadataBlock metric={undefined} onClose={onCloseMetadata} />
        )}
      </div>
    </div>
  );
}

interface CardModel {
  refId: string;
  dsRef: DataSourceRef;
  /** Undefined when the datasource no longer resolves; the host supplies a translated fallback. */
  dsName?: string;
  isPrometheus: boolean;
}

/**
 * One card per query, each resolved to its own concrete datasource. A query without an explicit
 * datasource inherits the pane's — except in a mixed pane, whose ref is not a real datasource and
 * must never reach a card or a data hook.
 */
function resolveCards(queries: DataQuery[] | undefined, datasourceInstance: DataSourceApi | null | undefined) {
  const paneRef = datasourceInstance?.meta.mixed ? undefined : datasourceInstance?.getRef();
  const dataSourceSrv = getDataSourceSrv();

  return (queries ?? []).map((query): CardModel => {
    const ref = query.datasource ?? paneRef;
    const settings = ref ? dataSourceSrv.getInstanceSettings(ref) : undefined;

    return {
      refId: query.refId,
      // Prefer the resolved settings over the raw ref so a card that inherited the pane's default
      // datasource still gets a concrete uid rather than a name-only or empty ref.
      dsRef: settings ? { uid: settings.uid, type: settings.type } : (ref ?? {}),
      dsName: settings?.name,
      // `matchPluginId`, not `type === 'prometheus'`: the managed flavours (Amazon, Azure) carry
      // their own plugin ids and browse exactly the same way.
      isPrometheus: settings ? matchPluginId('prometheus', settings.meta) : false,
    };
  });
}

interface SelectedMetricMetadataProps {
  dsRef: DataSourceRef;
  timeRange: TimeRange;
  metricName: string;
  onClose: () => void;
}

/**
 * Looks the selected metric up in the catalog of the card it was selected in — the only datasource
 * whose catalog can describe it. Mounted only while something is selected, which is what keeps this
 * `useMetricCatalog` call out of a loop over the cards.
 */
function SelectedMetricMetadata({ dsRef, timeRange, metricName, onClose }: SelectedMetricMetadataProps) {
  const { metrics } = useMetricCatalog(dsRef, timeRange);

  return <MetricMetadataBlock metric={metrics.find((metric) => metric.name === metricName)} onClose={onClose} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  rail: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
    minHeight: 0,
    padding: theme.spacing(1),
  }),
  cards: css({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: theme.spacing(1),
    minHeight: 0,
    overflowY: 'auto',
  }),
  dock: css({
    flexShrink: 0,
  }),
});
