import { css, cx, keyframes } from '@emotion/css';
import React from 'react';

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
  const styles = useStyles2(getStyles);
  const durationMs = Math.min(Math.max(Math.round(width * MILLISECONDS_PER_PIXEL), MIN_DURATION_MS), MAX_DURATION_MS);
  const animationStyles = {
    animationName: styles.animation,
    // an initial delay to prevent the loader from showing if the response is faster than the delay
    animationDelay: `${delay}ms`,
    animationDuration: `${durationMs}ms`,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    willChange: 'transform',
  };

  return (
    <div style={{ overflow: 'hidden' }}>
      <div aria-label={ariaLabel} className={cx(styles.bar, css(animationStyles))} />
    </div>
  );
}

const getStyles = () => {
  return {
    animation: keyframes({
      '0%': {
        transform: 'translateX(-100%)',
      },
      // this gives us a delay between iterations
      '85%, 100%': {
        transform: `translateX(${MAX_TRANSLATE_X}%)`,
      },
    }),
    bar: css({
      width: BAR_WIDTH + '%',
      height: 1,
      background: 'linear-gradient(90deg, rgba(110, 159, 255, 0) 0%, #6E9FFF 80.75%, rgba(110, 159, 255, 0) 100%)',
      transform: 'translateX(-100%)',
    }),
  };
};
