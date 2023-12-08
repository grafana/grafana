import { keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../themes';

export const withSkeleton = <T extends object, U>(component: T, skeleton: U) => {
  return Object.assign(component, { Skeleton: skeleton });
};

export const useSkeleton = () => {
  const styles = useStyles2(getStyles);
  return {
    skeletonProps: {
      style: styles,
    },
  };
};

export const getStyles = (theme: GrafanaTheme2) => {
  const animation = keyframes({
    '0%': {
      opacity: 0,
    },
    '100%': {
      opacity: 1,
    },
  });

  return {
    animationName: animation,
    animationDelay: '100ms',
    animationTimingFunction: theme.transitions.easing.easeIn,
    animationDuration: '100ms',
    animationFillMode: 'backwards',
  };
};
