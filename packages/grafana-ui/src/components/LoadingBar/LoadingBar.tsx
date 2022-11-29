import { css, keyframes } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';

/**
 * @internal
 */
export interface LoadingBarProps {
  containerWidth: number;
  width?: number;
  height?: number;
  ariaLabel?: string;
  barColor?: string;
}

/**
 * @internal
 */
export const LoadingBar: React.FC<LoadingBarProps> = ({
  containerWidth,
  width,
  height,
  ariaLabel = 'Loading bar',
  barColor = 'blue',
}) => {
  const theme = useTheme2();
  const loadingStyles = getLoadingStyes(theme, containerWidth, width, height, barColor);
  return <div className={loadingStyles.loading}></div>;
};

const getLoadingStyes = (
  theme: GrafanaTheme2,
  containerWidth: number,
  width?: number,
  height?: number,
  barColor?: string
) => {
  const loadingWidth = width ?? 128;
  const loadingAnimation = keyframes({
    '0%': {
      transform: 'translateX(0)',
    },
    '100%': {
      transform: `translateX(${containerWidth - loadingWidth}px)`,
    },
  });
  return {
    loading: css({
      width: `${loadingWidth}px`,
      height: `${height ?? 2}px`,
      background: 'linear-gradient(90deg, rgba(110, 159, 255, 0) 0%, #6E9FFF 80.75%, rgba(110, 159, 255, 0) 100%)',
      position: 'absolute',
      animation: `${loadingAnimation} 2s infinite linear`,
      willChange: 'transform',
    }),
  };
};
