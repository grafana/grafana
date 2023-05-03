import { css, keyframes } from '@emotion/css';
import React, { CSSProperties } from 'react';

import { useStyles2 } from '../../themes';

export interface LoadingBarProps {
  width: number;
  ariaLabel?: string;
}

const MILLISECONDS_PER_PIXEL = 2.4;
const MIN_DURATION_MS = 500;
const MAX_DURATION_MS = 4000;

export function LoadingBar({ width, ariaLabel = 'Loading bar' }: LoadingBarProps) {
  const styles = useStyles2(getStyles);
  const durationMs = Math.min(Math.max(Math.round(width * MILLISECONDS_PER_PIXEL), MIN_DURATION_MS), MAX_DURATION_MS);
  const containerStyles: CSSProperties = {
    width: '100%',
    animation: `${styles.animation} ${durationMs}ms infinite linear`,
    willChange: 'transform',
  };

  return (
    <div style={containerStyles}>
      <div aria-label={ariaLabel} className={styles.bar} />
    </div>
  );
}

const getStyles = () => {
  return {
    animation: keyframes({
      '0%': {
        transform: 'translateX(-50%)',
      },
      '100%': {
        transform: `translateX(100%)`,
      },
    }),
    bar: css({
      width: '28%',
      height: 1,
      background: 'linear-gradient(90deg, rgba(110, 159, 255, 0) 0%, #6E9FFF 80.75%, rgba(110, 159, 255, 0) 100%)',
    }),
  };
};
