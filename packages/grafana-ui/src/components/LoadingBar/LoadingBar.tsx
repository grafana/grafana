import { css, keyframes } from '@emotion/css';
import React from 'react';

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
export const LoadingBar: React.FC<LoadingBarProps> = ({ containerWidth, width, height, ariaLabel = 'Loading bar' }) => {
  const loadingStyles = getLoadingStyles(containerWidth, width, height);

  return <div aria-label={ariaLabel} className={loadingStyles.loading}></div>;
};

const getLoadingStyles = (containerWidth: number, width?: number, height?: number) => {
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
