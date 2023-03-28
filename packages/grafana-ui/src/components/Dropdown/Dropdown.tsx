import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import React, { useEffect, useRef, useState } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { CSSTransition } from 'react-transition-group';

import { ReactUtils } from '../../utils';
import { Portal } from '../Portal/Portal';
import { TooltipPlacement } from '../Tooltip/types';

export interface Props {
  overlay: React.ReactElement | (() => React.ReactElement);
  placement?: TooltipPlacement;
  children: React.ReactElement;
  /** Amount in pixels to nudge the dropdown vertically and horizontally, respectively. */
  offset?: [number, number];
  onVisibleChange?: (state: boolean) => void;
}

export const Dropdown = React.memo(({ children, overlay, placement, offset, onVisibleChange }: Props) => {
  const [show, setShow] = useState(false);
  const transitionRef = useRef(null);

  useEffect(() => {
    onVisibleChange?.(show);
  }, [onVisibleChange, show]);

  const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible } = usePopperTooltip({
    visible: show,
    placement: placement,
    onVisibleChange: setShow,
    interactive: true,
    delayHide: 0,
    delayShow: 0,
    offset: offset ?? [0, 8],
    trigger: ['click'],
  });

  const animationDuration = 150;
  const animationStyles = getStyles(animationDuration);

  const onOverlayClicked = () => {
    setShow(false);
  };

  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      setShow(false);
    }
  };

  return (
    <>
      {React.cloneElement(children, {
        ref: setTriggerRef,
      })}
      {visible && (
        <Portal>
          <FocusScope autoFocus restoreFocus contain>
            {/*
              this is handling bubbled events from the inner overlay
              see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
            */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div ref={setTooltipRef} {...getTooltipProps()} onClick={onOverlayClicked} onKeyDown={handleKeys}>
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
    appear: css({
      opacity: '0',
      position: 'relative',
      transform: 'scaleY(0.5)',
      transformOrigin: 'top',
    }),
    appearActive: css({
      opacity: '1',
      transform: 'scaleY(1)',
      transition: `transform ${duration}ms cubic-bezier(0.2, 0, 0.2, 1), opacity ${duration}ms cubic-bezier(0.2, 0, 0.2, 1)`,
    }),
  };
};
