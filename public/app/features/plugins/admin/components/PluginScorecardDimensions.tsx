import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { type CatalogPluginInsights } from '../types';

const COLOR_EXCELLENT = '#7ebb68';
const COLOR_GOOD = '#e4d060';
const COLOR_FAIR = '#f57c2a';

export function scorecardDimensionColor(level: string, theme: GrafanaTheme2): string {
  switch (level) {
    case 'Excellent':
      return COLOR_EXCELLENT;
    case 'Good':
      return COLOR_GOOD;
    case 'Fair':
      return COLOR_FAIR;
    default:
      return theme.colors.error.main;
  }
}

type Props = {
  insights: CatalogPluginInsights | undefined;
};

export function PluginScorecardDimensions({ insights }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  if (!insights?.insights?.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      {insights.insights.map((dim) => {
        const dotColor = scorecardDimensionColor(dim.scoreLevel, theme);
        const count = dim.items?.length ?? 0;
        return (
          <div key={dim.name} className={styles.row}>
            <span className={styles.dot} style={{ background: dotColor }} />
            <span className={styles.label}>{dim.name}</span>
            <span className={styles.right}>
              {count > 1 && <span className={styles.badge}>⚠ {count}</span>}
              <span className={styles.score}>{dim.scoreLevel || '—'}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    minWidth: '160px',
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  dot: css({
    width: '8px',
    height: '8px',
    borderRadius: theme.shape.radius.circle,
    flexShrink: 0,
  }),
  label: css({
    textTransform: 'capitalize',
    color: theme.colors.text.secondary,
    flexGrow: 1,
    fontSize: theme.typography.size.sm,
  }),
  right: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  score: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.sm,
  }),
  badge: css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.pill,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
    lineHeight: 1,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.5)}`,
  }),
});
