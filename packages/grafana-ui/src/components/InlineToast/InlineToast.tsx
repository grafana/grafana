import { css, cx } from '@emotion/css';
import { autoUpdate, flip, offset, shift, Side, useFloating, useTransitionStyles } from '@floating-ui/react';
import { useLayoutEffect } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { Portal } from '../Portal/Portal';

export interface InlineToastProps {
  children: React.ReactNode;
  suffixIcon?: IconName;
  referenceElement: HTMLElement | null;
  placement: Side;
  /**
   * @deprecated
   * Placement to use if there is not enough space to show the full toast with the original placement
   * This is now done automatically.
   */
  alternativePlacement?: Side;
}

export function InlineToast({ referenceElement, children, suffixIcon, placement }: InlineToastProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  // the order of middleware is important!
  // `arrow` should almost always be at the end
  // see https://floating-ui.com/docs/arrow#order
  const middleware = [
    offset(8),
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: true,
    placement,
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  useLayoutEffect(() => {
    refs.setReference(referenceElement);
  }, [referenceElement, refs]);

  const { styles: placementStyles } = useTransitionStyles(context, {
    initial: ({ side }) => {
      return {
        opacity: 0,
        transform: getInitialTransform(side, theme),
      };
    },
    duration: theme.transitions.duration.shortest,
  });

  return (
    <Portal>
      <div style={{ display: 'inline-block', ...floatingStyles }} ref={refs.setFloating} aria-live="polite">
        <span className={cx(styles.root)} style={placementStyles}>
          {children && <span>{children}</span>}
          {suffixIcon && <Icon name={suffixIcon} />}
        </span>
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    root: css({
      ...theme.typography.bodySmall,
      willChange: 'transform',
      background: theme.components.tooltip.background,
      color: theme.components.tooltip.text,
      padding: theme.spacing(0.5, 1.5), // get's an extra .5 of vertical padding to account for the rounded corners
      borderRadius: theme.shape.radius.pill,
      display: 'inline-flex',
      gap: theme.spacing(0.5),
      alignItems: 'center',
    }),
  };
};

const getInitialTransform = (placement: InlineToastProps['placement'], theme: GrafanaTheme2) => {
  const gap = 1;

  switch (placement) {
    case 'top':
      return `translateY(${theme.spacing(gap)})`;
    case 'bottom':
      return `translateY(-${theme.spacing(gap)})`;
    case 'left':
      return `translateX(${theme.spacing(gap)})`;
    case 'right':
      return `translateX(-${theme.spacing(gap)})`;
  }
};
