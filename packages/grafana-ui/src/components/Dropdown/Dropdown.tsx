import { css } from '@emotion/css';
import React from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { CSSTransition } from 'react-transition-group';

import { ReactUtils } from '../../utils';
import { Portal } from '../Portal/Portal';
import { TooltipPlacement } from '../Tooltip/types';

type OverlayFunc = () => React.ReactElement;

export interface Props {
  overlay: React.ReactElement | OverlayFunc;
  /** Set to true force dropdown overlay to be visible */
  show?: boolean;
  placement?: TooltipPlacement;
  children: React.ReactElement;
  /** Defaults to click */
  trigger?: Array<'click' | 'hover'>;
}

export const Dropdown = React.memo(({ children, overlay, show, placement, trigger = ['click'] }: Props) => {
  const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible } = usePopperTooltip({
    visible: show,
    placement: placement,
    interactive: true,
    delayHide: 200,
    delayShow: 150,
    offset: [0, 8],
    trigger: trigger,
  });

  const animationDuration = 150;
  const animationStyles = getStyles(animationDuration);

  return (
    <>
      {React.cloneElement(children, {
        ref: setTriggerRef,
      })}
      {visible && (
        <Portal>
          <div ref={setTooltipRef} {...getTooltipProps()}>
            <div {...getArrowProps({ className: 'tooltip-arrow' })} />
            <CSSTransition appear={true} in={true} timeout={animationDuration} classNames={animationStyles}>
              {ReactUtils.renderOrCallToRender(overlay)}
            </CSSTransition>
          </div>
        </Portal>
      )}
    </>
  );
});

Dropdown.displayName = 'Dropdown';

const getStyles = (duration: number) => {
  return {
    appear: css`
      label: enter;
      opacity: 0;
      position: relative;
      transform: scaleY(0.5);
      transform-origin: top;
    `,
    appearActive: css`
      label: enterActive;
      opacity: 1;
      transform: scaleY(1);
      transition: transform ${duration}ms cubic-bezier(0.2, 0, 0.2, 1),
        opacity ${duration}ms cubic-bezier(0.2, 0, 0.2, 1);
    `,
  };
};
