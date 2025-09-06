import { css } from '@emotion/css';
import {
  FloatingFocusManager,
  autoUpdate,
  flip,
  offset as floatingUIOffset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { useCallback, useRef, useState } from 'react';
import * as React from 'react';
import { CSSTransition } from 'react-transition-group';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { renderOrCallToRender } from '../../utils/reactUtils';
import { getPlacement } from '../../utils/tooltipUtils';
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

  const handleOpenChange = useCallback(
    (newState: boolean) => {
      setShow(newState);
      onVisibleChange?.(newState);
    },
    [onVisibleChange]
  );

  // the order of middleware is important!
  const middleware = [
    floatingUIOffset({
      mainAxis: offset?.[0] ?? 8,
      crossAxis: offset?.[1] ?? 0,
    }),
    flip({
      fallbackAxisSideDirection: 'end',
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
    }),
    shift(),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: show,
    placement: getPlacement(placement),
    onOpenChange: handleOpenChange,
    middleware,
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

  const animationDuration = 150;
  const animationStyles = useStyles2(getStyles, animationDuration);

  const onOverlayClicked = () => {
    handleOpenChange(false);
  };

  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      handleOpenChange(false);
    }
  };

  return (
    <>
      {React.cloneElement(children, {
        ref: refs.setReference,
        ...getReferenceProps(),
      })}
      {show && (
        <Portal>
          <FloatingFocusManager context={context}>
            {/*
              this is handling bubbled events from the inner overlay
              see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
            */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div ref={refs.setFloating} style={floatingStyles} onClick={onOverlayClicked} onKeyDown={handleKeys}>
              <CSSTransition
                nodeRef={transitionRef}
                appear={true}
                in={true}
                timeout={{ appear: animationDuration, exit: 0, enter: 0 }}
                classNames={animationStyles}
              >
                <div ref={transitionRef}>{renderOrCallToRender(overlay, { ...getFloatingProps() })}</div>
              </CSSTransition>
            </div>
          </FloatingFocusManager>
        </Portal>
      )}
    </>
  );
});

Dropdown.displayName = 'Dropdown';

const getStyles = (theme: GrafanaTheme2, duration: number) => {
  return {
    appear: css({
      opacity: '0',
      position: 'relative',
      transformOrigin: 'top',
      [theme.transitions.handleMotion('no-preference')]: {
        transform: 'scaleY(0.5)',
      },
    }),
    appearActive: css({
      opacity: '1',
      [theme.transitions.handleMotion('no-preference')]: {
        transform: 'scaleY(1)',
        transition: `transform ${duration}ms cubic-bezier(0.2, 0, 0.2, 1), opacity ${duration}ms cubic-bezier(0.2, 0, 0.2, 1)`,
      },
    }),
  };
};
