import { css, keyframes } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

export interface LoadingBarProps {
  width?: string;
  height?: string;
  ariaLabel?: string;
}

export function LoadingBar({ width, height, ariaLabel = 'Loading bar' }: LoadingBarProps) {
  const styles = useStyles2(getStyles(width, height));

  return (
    <div className={styles.container}>
      <div aria-label={ariaLabel} className={styles.bar} />
    </div>
  );
}

const getStyles = (width?: string, height?: string) => (_: GrafanaTheme2) => {
  const barWidth = width ?? '128px';
  const loadingHeigth = height ?? '2px';

  const loadingAnimation = keyframes({
    '0%': {
      transform: 'translateX(0)',
    },
    '100%': {
      transform: `translateX(calc(100% - ${barWidth}))`,
    },
  });

  return {
    container: css({
      width: '100%',
      animation: `${loadingAnimation} 2s infinite linear`,
      willChange: 'transform',
    }),
    bar: css({
      width: barWidth,
      height: loadingHeigth,
      background: 'linear-gradient(90deg, rgba(110, 159, 255, 0) 0%, #6E9FFF 80.75%, rgba(110, 159, 255, 0) 100%)',
    }),
  };
};
