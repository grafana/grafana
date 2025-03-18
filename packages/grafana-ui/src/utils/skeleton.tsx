import { keyframes } from '@emotion/css';
import * as React from 'react';

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
  /**
   * Spread these props at the root of your skeleton to handle animation logic
   */
  rootProps: {
    style: React.CSSProperties;
  };
}

export type SkeletonComponent<P = {}> = React.ComponentType<P & SkeletonProps>;

/**
 * Use this to attach a skeleton as a static property on the component.
 * e.g. if you render a component with `<Component />`, you can render the skeleton with `<Component.Skeleton />`.
 * @param Component   A functional or class component
 * @param Skeleton    A functional or class skeleton component
 * @returns           A wrapped component with a static skeleton property
 */
export const attachSkeleton = <C extends object, P>(Component: C, Skeleton: SkeletonComponent<P>) => {
  const skeletonWrapper = (props: P) => {
    return (
      <Skeleton
        {...props}
        rootProps={{
          style: skeletonAnimation,
        }}
      />
    );
  };
  return Object.assign(Component, { Skeleton: skeletonWrapper });
};
