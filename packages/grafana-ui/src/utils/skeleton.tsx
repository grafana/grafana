import { keyframes } from '@emotion/css';
import React from 'react';

const fadeIn = keyframes({
  '0%': {
    opacity: 0,
  },
  '100%': {
    opacity: 1,
  },
});

export const skeletonAnimation = {
  animationName: fadeIn,
  animationDelay: '100ms',
  animationTimingFunction: 'ease-in',
  animationDuration: '100ms',
  animationFillMode: 'backwards',
};

interface SkeletonProps {
  skeletonProps: {
    style: React.CSSProperties;
  };
}

export type SkeletonComponent<P = {}> = React.ComponentType<P & SkeletonProps>;

export const withSkeleton = <C extends object, P>(component: C, Skeleton: SkeletonComponent<P>) => {
  const skeletonWrapper = (props: P) => {
    return (
      <Skeleton
        {...props}
        skeletonProps={{
          style: skeletonAnimation,
        }}
      />
    );
  };
  return Object.assign(component, { Skeleton: skeletonWrapper });
};
