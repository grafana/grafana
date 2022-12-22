import { css, cx, keyframes } from '@emotion/css';
import { BasePlacement } from '@popperjs/core';
import React, { useState } from 'react';
import { usePopper } from 'react-popper';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { Portal } from '../Portal/Portal';

export interface InlineToastProps {
  children: React.ReactNode;
  suffixIcon?: IconName;
  referenceElement: HTMLElement | null;
  placement: BasePlacement;
}

export function InlineToast({ referenceElement, children, suffixIcon, placement }: InlineToastProps) {
  const [indicatorElement, setIndicatorElement] = useState<HTMLElement | null>(null);
  const popper = usePopper(referenceElement, indicatorElement, { placement });
  const styles = useStyles2(getStyles);
  const placementStyles = useStyles2(getPlacementStyles);

  return (
    <Portal>
      <div
        style={{ display: 'inline-block', ...popper.styles.popper }}
        {...popper.attributes.popper}
        ref={setIndicatorElement}
      >
        <span className={cx(styles.root, placementStyles[placement])}>
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
      borderRadius: 100, // just a sufficiently large value to ensure ends are completely rounded
      display: 'inline-flex',
      gap: theme.spacing(0.5),
      alignItems: 'center',
    }),
  };
};

const createAnimation = (fromX: string | number, fromY: string | number) =>
  keyframes({
    from: {
      opacity: 0,
      transform: `translate(${fromX}, ${fromY})`,
    },

    to: {
      opacity: 1,
      transform: 'translate(0, 0px)',
    },
  });

const getPlacementStyles = (theme: GrafanaTheme2): Record<InlineToastProps['placement'], string> => {
  const gap = 1;

  const placementTopAnimation = createAnimation(0, theme.spacing(gap));
  const placementBottomAnimation = createAnimation(0, theme.spacing(gap * -1));
  const placementLeftAnimation = createAnimation(theme.spacing(gap), 0);
  const placementRightAnimation = createAnimation(theme.spacing(gap * -1), 0);

  return {
    top: css({
      marginBottom: theme.spacing(gap),
      animation: `${placementTopAnimation} ease-out 100ms`,
    }),
    bottom: css({
      marginTop: theme.spacing(gap),
      animation: `${placementBottomAnimation} ease-out 100ms`,
    }),
    left: css({
      marginRight: theme.spacing(gap),
      animation: `${placementLeftAnimation} ease-out 100ms`,
    }),
    right: css({
      marginLeft: theme.spacing(gap),
      animation: `${placementRightAnimation} ease-out 100ms`,
    }),
  };
};
