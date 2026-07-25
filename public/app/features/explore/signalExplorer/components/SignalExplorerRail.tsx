import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type DataSourceRef, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { selectPanes } from '../../state/selectors';
import { useMetricCatalog } from '../data/useMetricCatalog';
import { resolveCards } from '../query/resolveCards';
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

  // One narrow subscription per field rather than one to the pane object: the pane's identity
  // changes on every query-response tick, which would re-render the whole card column — and every
  // catalog list inside it — on churn this rail does not care about.
  const queries = useSelector((state) => selectPanes(state)[exploreId]?.queries);
  const range = useSelector((state) => selectPanes(state)[exploreId]?.range);
  const datasourceInstance = useSelector((state) => selectPanes(state)[exploreId]?.datasourceInstance);
  const activeRefId = useSelector((state) => selectActiveRefId(state, exploreId));
  const selectedMetric = useSelector((state) => selectSelectedMetric(state, exploreId));

  const cards = useMemo(() => resolveCards(queries, datasourceInstance), [queries, datasourceInstance]);

  const selectedCard = cards.find((card) => card.refId === selectedMetric?.refId);
  const onCloseMetadata = () => dispatch(clearSelectedMetric({ exploreId }));

  // A closed or not-yet-initialized pane: `queries` and `range` are only absent together, and
  // nothing below can be rendered without a range to fetch against.
  if (!queries || !range) {
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
            timeRange={range}
            matchQueries={card.matchQueries}
          />
        ))}
      </div>
      <div className={styles.dock}>
        {selectedMetric && selectedCard?.isPrometheus ? (
          <SelectedMetricMetadata
            dsRef={selectedCard.dsRef}
            timeRange={range}
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
