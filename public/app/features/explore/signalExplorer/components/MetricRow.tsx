import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

// The component and the data shape share a name; alias the type so the component keeps the plain
// name the rest of the tree refers to it by.
import type { MetricRow as MetricRowModel } from '../types';

export interface MetricRowProps {
  metric: MetricRowModel;
  /** refIds of the queries in this pane that already reference this metric. */
  refBadges: string[];
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}

export function MetricRow({ metric, refBadges, selected, expanded, onSelect, onToggleExpand }: MetricRowProps) {
  const styles = useStyles2(getStyles);

  const toggleLabel = expanded
    ? t('explore.signal-explorer.metric-row.collapse', 'Collapse {{name}}', { name: metric.name })
    : t('explore.signal-explorer.metric-row.expand', 'Expand {{name}}', { name: metric.name });

  return (
    <div className={cx(styles.row, selected && styles.rowHighlighted)} data-testid="signal-explorer-metric-row">
      <IconButton
        name={expanded ? 'angle-down' : 'angle-right'}
        aria-label={toggleLabel}
        aria-expanded={expanded}
        onClick={onToggleExpand}
      />
      <button type="button" className={styles.name} onClick={onSelect}>
        {metric.name}
      </button>
      {refBadges.map((badge) => (
        <span key={badge} className={styles.badge}>
          {badge}
        </span>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  rowHighlighted: css({
    background: theme.colors.action.selected,
  }),
  name: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    background: 'none',
    border: 'none',
    padding: 0,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
  }),
  badge: css({
    flexShrink: 0,
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
