import { css, keyframes } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

/**
 * @internal
 */
export interface LoadingBarProps {
  containerWidth: number;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

/**
 * @internal
 */
export function LoadingBar({ containerWidth, width, height, ariaLabel = 'Loading bar' }: LoadingBarProps) {
  const styles = useStyles2(getStyles(containerWidth, width, height));

  return (
    <div className={styles.container}>
      <div aria-label={ariaLabel} className={styles.bar} />
    </div>
  );
}

const getStyles = (_: number, width?: number, height?: number) => (_: GrafanaTheme2) => {
  const barWidth = width ?? 128;
  const loadingHeigth = height ?? 2;

  const loadingAnimation = keyframes({
    '0%': {
      transform: 'translateX(0)',
    },
    '100%': {
      transform: `translateX(calc(100% - ${barWidth}px))`,
    },
  });

  return {
    container: css({
      width: '100%',
      height: `${loadingHeigth}px`,
      animation: `${loadingAnimation} 2s infinite linear`,
      // position: 'absolute',
      // willChange: 'transform',
    }),
    bar: css({
      width: `${barWidth}px`,
      height: `${loadingHeigth}px`,
      background: 'linear-gradient(90deg, rgba(110, 159, 255, 0) 0%, #6E9FFF 80.75%, rgba(110, 159, 255, 0) 100%)',
      // transform: 'translateX(-100%)',
    }),
  };
};
