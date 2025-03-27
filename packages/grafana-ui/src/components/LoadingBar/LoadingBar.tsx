import { css, keyframes } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface LoadingBarProps {
  width: number;
  delay?: number;
  ariaLabel?: string;
}

const BAR_WIDTH = 28;
const MILLISECONDS_PER_PIXEL = 2.4;
const MIN_DURATION_MS = 500;
const MAX_DURATION_MS = 4000;
const DEFAULT_ANIMATION_DELAY = 300;
const MAX_TRANSLATE_X = (100 / BAR_WIDTH) * 100;

export function LoadingBar({ width, delay = DEFAULT_ANIMATION_DELAY, ariaLabel = 'Loading bar' }: LoadingBarProps) {
  const durationMs = Math.min(Math.max(Math.round(width * MILLISECONDS_PER_PIXEL), MIN_DURATION_MS), MAX_DURATION_MS);
  const styles = useStyles2(getStyles, delay, durationMs);
  const containerStyles: CSSProperties = {
    overflow: 'hidden',
  };

  return (
    <div style={containerStyles}>
      <div aria-label={ariaLabel} className={styles.bar} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, delay: number, duration: number) => {
  const animation = keyframes({
    '0%': {
      transform: 'translateX(-100%)',
    },
    // this gives us a delay between iterations
    '85%, 100%': {
      transform: `translateX(${MAX_TRANSLATE_X}%)`,
    },
  });

  return {
    bar: css({
      width: BAR_WIDTH + '%',
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${theme.colors.primary.main} 80.75%, transparent 100%)`,
      transform: 'translateX(-100%)',
      willChange: 'transform',
      [theme.transitions.handleMotion('no-preference')]: {
        animationName: animation,
        // an initial delay to prevent the loader from showing if the response is faster than the delay
        animationDelay: `${delay}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDuration: `${duration}ms`,
      },
      [theme.transitions.handleMotion('reduce')]: {
        animationName: animation,
        // an initial delay to prevent the loader from showing if the response is faster than the delay
        animationDelay: `${delay}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
        animationDuration: `${4 * duration}ms`,
      },
    }),
  };
};
