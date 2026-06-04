import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function SemicircleGauge({ pct }: { pct: number }) {
  const styles = useStyles2(getStyles);
  // Half-circle with radius 40 centered at (50, 50). Path goes from (10,50)
  // along the top arc to (90,50). Length = π * r = π * 40 ≈ 125.66.
  const radius = 40;
  const length = Math.PI * radius;
  const dashLen = Math.max(0, Math.min(1, pct)) * length;
  return (
    // The gauge is purely decorative — the surrounding card already exposes
    // the same percentage and "managed / total" fraction in text, so we drop
    // role="img" and mark the SVG as hidden so screen readers don't read the
    // percentage twice.
    <svg width="120" height="68" viewBox="0 0 100 60" className={styles.gauge} aria-hidden="true">
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
        className={styles.gaugeTrack}
      />
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${dashLen} ${length}`}
        className={styles.gaugeFill}
      />
    </svg>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  gauge: css({
    alignSelf: 'center',
  }),
  gaugeTrack: css({
    stroke: theme.colors.background.canvas,
  }),
  gaugeFill: css({
    stroke: theme.colors.success.main,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'stroke-dasharray 240ms ease',
    },
  }),
});
