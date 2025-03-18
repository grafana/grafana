import {
  FloatingArrow,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  useTransitionStyles,
} from '@floating-ui/react';
import { useLayoutEffect, useRef } from 'react';
import * as React from 'react';

import { useTheme2 } from '../../themes';
import { getPlacement } from '../../utils/tooltipUtils';
import { Portal } from '../Portal/Portal';

import { PopoverContent, TooltipPlacement } from './types';

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  show: boolean;
  placement?: TooltipPlacement;
  content: PopoverContent;
  referenceElement: HTMLElement;
  wrapperClassName?: string;
  renderArrow?: boolean;
  hidePopper?: () => void;
}

export function Popover({
  content,
  show,
  placement,
  className,
  wrapperClassName,
  referenceElement,
  renderArrow,
  hidePopper,
  ...rest
}: Props) {
  const theme = useTheme2();
  const arrowRef = useRef(null);

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

  if (renderArrow) {
    middleware.push(
      arrow({
        element: arrowRef,
      })
    );
  }

  const { context, refs, floatingStyles } = useFloating({
    open: show,
    placement: getPlacement(placement),
    middleware,
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  useLayoutEffect(() => {
    refs.setReference(referenceElement);
  }, [referenceElement, refs]);

  const { styles: placementStyles } = useTransitionStyles(context, {
    initial: () => ({
      opacity: 0,
    }),
    duration: theme.transitions.duration.enteringScreen,
  });

  return show ? (
    <Portal>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          ...placementStyles,
        }}
        className={wrapperClassName}
        {...rest}
      >
        <div className={className}>
          {renderArrow && <FloatingArrow fill={theme.colors.border.weak} ref={arrowRef} context={context} />}
          {typeof content === 'string' && content}
          {React.isValidElement(content) && React.cloneElement(content)}
          {typeof content === 'function' && content({ hidePopper })}
        </div>
      </div>
    </Portal>
  ) : undefined;
}
