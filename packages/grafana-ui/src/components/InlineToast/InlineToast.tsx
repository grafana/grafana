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
  // Placement to use if there is not enough space to show the full toast with the original placement
  alternativePlacement?: BasePlacement;
}

export function InlineToast({
  referenceElement,
  children,
  suffixIcon,
  placement,
  alternativePlacement,
}: InlineToastProps) {
  const [indicatorElement, setIndicatorElement] = useState<HTMLElement | null>(null);
  const [toastPlacement, setToastPlacement] = useState(placement);
  const popper = usePopper(referenceElement, indicatorElement, { placement: toastPlacement });
  const styles = useStyles2(getStyles);
  const placementStyles = useStyles2(getPlacementStyles);

  React.useEffect(() => {
    if (alternativePlacement && shouldUseAlt(placement, indicatorElement, referenceElement)) {
      setToastPlacement(alternativePlacement);
    }
  }, [alternativePlacement, placement, indicatorElement, referenceElement]);

  return (
    <Portal>
      <div
        style={{ display: 'inline-block', ...popper.styles.popper }}
        {...popper.attributes.popper}
        ref={setIndicatorElement}
        aria-live="polite"
      >
        <span className={cx(styles.root, placementStyles[toastPlacement])}>
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

//To calculate if the InlineToast is displayed off-screen and should use the alternative placement
const shouldUseAlt = (
  placement: BasePlacement,
  indicatorElement: HTMLElement | null,
  referenceElement: HTMLElement | null
) => {
  const indicatorSizes = indicatorElement?.getBoundingClientRect();
  const referenceSizes = referenceElement?.getBoundingClientRect();
  if (!indicatorSizes || !referenceSizes) {
    return false;
  }
  switch (placement) {
    case 'right':
      return indicatorSizes.width + referenceSizes.right > window.innerWidth;
    case 'bottom':
      return indicatorSizes.height + referenceSizes.bottom > window.innerHeight;
    case 'left':
      return referenceSizes.left - indicatorSizes.width < 0;
    case 'top':
      return referenceSizes.top - indicatorSizes.height < 0;
    default:
      return false;
  }
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
