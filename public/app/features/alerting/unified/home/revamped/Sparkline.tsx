import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const WIDTH = 100;
const HEIGHT = 28;

/**
 * A small trend line with no axes. It stretches to its container's width and needs at least two
 * points; with fewer it renders nothing.
 */
export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const styles = useStyles2(getStyles);

  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  // Keep the stroke inside the box at the top and bottom.
  const y = (value: number) => 2 + (HEIGHT - 4) * (1 - (value - min) / span);
  const x = (index: number) => (index / (values.length - 1)) * WIDTH;
  const points = values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' ');

  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  sparkline: css({
    display: 'block',
    width: '100%',
    height: 28,
    overflow: 'visible',
  }),
});
