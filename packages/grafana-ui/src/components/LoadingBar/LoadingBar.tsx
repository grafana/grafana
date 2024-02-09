import { css, keyframes } from '@emotion/css';
import React, { CSSProperties } from 'react';

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

export function LoadingBar({ width, delay = DEFAULT_ANIMATION_DELAY, ariaLabel = 'Loading bar' }: LoadingBarProps) {
  const durationMs = Math.min(Math.max(Math.round(width * MILLISECONDS_PER_PIXEL), MIN_DURATION_MS), MAX_DURATION_MS);
  const styles = useStyles2(getStyles, delay, durationMs);
  const containerStyles: CSSProperties = {
    overflow: 'hidden',
    position: 'relative',
    height: 1,
  };

  return (
    <div style={containerStyles}>
      <div aria-label={ariaLabel} className={styles.bar} />
    </div>
  );
}

const getStyles = (_theme: GrafanaTheme2, delay: number, duration: number) => {
  const animation = keyframes({
    '0%': {
      left: `-${BAR_WIDTH}%`,
    },
    // this gives us a delay between iterations
    '85%, 100%': {
      left: '100%',
    },
  });

  return {
    bar: css({
      width: BAR_WIDTH + '%',
      height: 1,
      background: 'linear-gradient(90deg, rgba(110, 159, 255, 0) 0%, #6E9FFF 80.75%, rgba(110, 159, 255, 0) 100%)',
      left: `-${BAR_WIDTH}%`,
      position: 'absolute',
      animationName: animation,
      // an initial delay to prevent the loader from showing if the response is faster than the delay
      animationDelay: `${delay}ms`,
      animationDuration: `${duration}ms`,
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
    }),
  };
};
