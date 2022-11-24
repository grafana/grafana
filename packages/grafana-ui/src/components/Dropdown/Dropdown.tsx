import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import React, { useRef, useState } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { CSSTransition } from 'react-transition-group';

import { ReactUtils } from '../../utils';
import { Portal } from '../Portal/Portal';
import { TooltipPlacement } from '../Tooltip/types';

export interface Props {
  overlay: React.ReactElement | (() => React.ReactElement);
  placement?: TooltipPlacement;
  children: React.ReactElement | ((isOpen: boolean) => React.ReactElement);
}

export const Dropdown = React.memo(({ children, overlay, placement }: Props) => {
  const [show, setShow] = useState(false);
  const transitionRef = useRef(null);

  const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible } = usePopperTooltip({
    visible: show,
    placement: placement,
    onVisibleChange: setShow,
    interactive: true,
    delayHide: 0,
    delayShow: 0,
    offset: [0, 8],
    trigger: ['click'],
  });

  const animationDuration = 150;
  const animationStyles = getStyles(animationDuration);

  const onOverlayClicked = () => {
    setShow(false);
  };

  return (
    <>
      {React.cloneElement(typeof children === 'function' ? children(visible) : children, {
        ref: setTriggerRef,
      })}
      {visible && (
        <Portal>
          <FocusScope autoFocus>
            <div ref={setTooltipRef} {...getTooltipProps()} onClick={onOverlayClicked}>
              <div {...getArrowProps({ className: 'tooltip-arrow' })} />
              <CSSTransition
                nodeRef={transitionRef}
                appear={true}
                in={true}
                timeout={{ appear: animationDuration, exit: 0, enter: 0 }}
                classNames={animationStyles}
              >
                <div ref={transitionRef}>{ReactUtils.renderOrCallToRender(overlay)}</div>
              </CSSTransition>
            </div>
          </FocusScope>
        </Portal>
      )}
    </>
  );
});

Dropdown.displayName = 'Dropdown';

const getStyles = (duration: number) => {
  return {
    appear: css`
      opacity: 0;
      position: relative;
      transform: scaleY(0.5);
      transform-origin: top;
    `,
    appearActive: css`
      opacity: 1;
      transform: scaleY(1);
      transition: transform ${duration}ms cubic-bezier(0.2, 0, 0.2, 1),
        opacity ${duration}ms cubic-bezier(0.2, 0, 0.2, 1);
    `,
  };
};
