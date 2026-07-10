import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SEVERITY_DEFINITIONS, type SeverityLevel } from './severity';

interface SeverityBarsProps {
  level: SeverityLevel | undefined;
}

const BAR_HEIGHTS = [4, 7, 10, 13];

/** Four ascending bars; `filled` of them colored by severity level (alerting's canonical severity visual). */
export function SeverityBars({ level }: SeverityBarsProps) {
  const styles = useStyles2(getStyles);
  const def = SEVERITY_DEFINITIONS.find((d) => d.level === level);
  const filled = def?.bars ?? 0;
  const colorClass = def ? styles[`bar_${def.level}`] : styles.barEmpty;

  return (
    <span className={styles.bars} aria-hidden>
      {BAR_HEIGHTS.map((height, i) => (
        <span key={i} className={cx(styles.bar, i < filled ? colorClass : styles.barEmpty)} style={{ height }} />
      ))}
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bars: css({
    display: 'inline-flex',
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  }),
  bar: css({
    width: 4,
    borderRadius: theme.shape.radius.default,
  }),
  barEmpty: css({
    background: theme.colors.border.medium,
  }),
  bar_low: css({
    background: theme.colors.success.text,
  }),
  bar_minor: css({
    background: theme.colors.warning.text,
  }),
  bar_major: css({
    background: theme.colors.warning.main,
  }),
  bar_critical: css({
    background: theme.colors.error.text,
  }),
});
