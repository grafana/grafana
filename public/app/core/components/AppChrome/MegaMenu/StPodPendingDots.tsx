import { css, cx, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { STPodHealthPoller } from 'app/core/navigation/STPodHealthPoller';

const SIZE = 14;

// GrafanaRoute only polls when the current route is not allowlisted, so on an allowlisted page
// nothing else would ever mark the pod ready.
export function StPodPendingDots() {
  const styles = useStyles2(getStyles);

  return (
    <>
      <STPodHealthPoller skip={false} />
      <svg
        className={cx('st-pod-dots', styles.dots)}
        width={SIZE}
        height={SIZE}
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
        focusable="false"
      >
        <circle className={styles.dot} cx={2.5} cy={7} r={1.5} />
        <circle className={styles.dot} cx={7} cy={7} r={1.5} />
        <circle className={styles.dot} cx={11.5} cy={7} r={1.5} />
      </svg>
    </>
  );
}

const pulse = keyframes({
  '0%, 60%, 100%': { opacity: 0.3 },
  '30%': { opacity: 1 },
});

const getStyles = (theme: GrafanaTheme2) => ({
  dots: css({
    flexShrink: 0,
    opacity: 0.35,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'opacity 0.15s ease',
    },
  }),
  dot: css({
    fill: 'currentColor',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${pulse} 1.2s ease-in-out infinite`,
      '&:nth-child(2)': { animationDelay: '0.2s' },
      '&:nth-child(3)': { animationDelay: '0.4s' },
    },
  }),
});
