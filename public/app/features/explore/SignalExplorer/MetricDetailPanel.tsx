import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, type BadgeColor, IconButton, useStyles2 } from '@grafana/ui';

import { type MetricInfo, type MetricType } from './types';

interface Props {
  /** The query whose list the metric came from — rendered, because a Mixed pane has more than one. */
  refId: string;
  metric: MetricInfo;
  onClose: () => void;
}

const BADGE_COLORS: Record<MetricType, BadgeColor> = {
  counter: 'blue',
  histogram: 'orange',
  // Shares the histogram colour: a separate one would suggest a different kind of signal.
  'native histogram': 'orange',
  summary: 'purple',
  gauge: 'green',
  unknown: 'darkgrey',
};

/**
 * Detail of the metric selected in a SignalCard's list, pinned to the bottom of the Datasource
 * explorer sidebar. Presentational: everything comes from the catalog entry the list already holds,
 * so selecting a metric costs no request.
 */
export function MetricDetailPanel({ refId, metric, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const fromQuery = t('explore.metric-detail-panel.from-query', 'Query {{refId}}', { refId });

  return (
    <section
      className={styles.panel}
      aria-label={t('explore.metric-detail-panel.aria-label', 'Metric details')}
      data-testid="metric-detail-panel"
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <Badge text={metric.type.toUpperCase()} color={BADGE_COLORS[metric.type]} />
          {/* refIds are user-editable, so the full value goes in a tooltip and the label truncates
              rather than pushing the close button out of the panel. */}
          <span className={styles.fromQuery} title={fromQuery}>
            {fromQuery}
          </span>
          <IconButton
            name="times"
            size="sm"
            variant="secondary"
            tooltip={t('explore.metric-detail-panel.close', 'Close metric details')}
            onClick={onClose}
          />
        </div>
        <div className={styles.name}>{metric.name}</div>
        {metric.help && <div className={styles.description}>{metric.help}</div>}
        {/* Additional data (active series, scrape interval, cardinality) lands here. */}
      </div>
    </section>
  );
}

/** Roughly six lines at the sidebar's width, which covers a stock Prometheus catalog. */
const DESCRIPTION_MAX_HEIGHT = 100;

const getStyles = (theme: GrafanaTheme2) => ({
  // Takes the height it needs; the card list's scroll region above gives up exactly that much. The
  // rule runs the full sidebar width, so it sits on the wrapper rather than the inset card.
  panel: css({
    label: 'metric-detail-panel',
    flex: '0 0 auto',
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  card: css({
    label: 'metric-detail-panel-card',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  header: css({
    label: 'metric-detail-panel-header',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  fromQuery: css({
    label: 'metric-detail-panel-from-query',
    // Takes the room between the badge and the close button, and gives it up first when short of it.
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'right',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  name: css({
    label: 'metric-detail-panel-name',
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    overflowWrap: 'anywhere',
  }),
  // Help text is unbounded and every line of it costs the card list above. Capped so a verbose metric
  // takes a known amount of room instead of all of it.
  description: css({
    label: 'metric-detail-panel-description',
    maxHeight: DESCRIPTION_MAX_HEIGHT,
    overflowY: 'auto',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
