import { css } from '@emotion/css';
import {
  FloatingFocusManager,
  autoUpdate,
  offset as floatingUIOffset,
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
import { getPositioningMiddleware } from '../../utils/floating';
import { renderOrCallToRender } from '../../utils/reactUtils';
import { getPlacement } from '../../utils/tooltipUtils';
import { Portal } from '../Portal/Portal';
import { TooltipPlacement } from '../Tooltip/types';

export interface Props {
  overlay: React.ReactElement | (() => React.ReactElement);
  placement?: TooltipPlacement;
  children: React.ReactElement;
  root?: HTMLElement;
  /** Amount in pixels to nudge the dropdown vertically and horizontally, respectively. */
  offset?: [number, number];
  onVisibleChange?: (state: boolean) => void;
}

export const Dropdown = React.memo(({ children, overlay, placement, offset, root, onVisibleChange }: Props) => {
  const [show, setShow] = useState(false);
  const transitionRef = useRef(null);
  const floatingUIPlacement = getPlacement(placement);

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
    ...getPositioningMiddleware(floatingUIPlacement),
  ];

  const { context, refs, floatingStyles } = useFloating({
    open: show,
    placement: floatingUIPlacement,
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
        <Portal root={root}>
          <FloatingFocusManager context={context}>
            {/*
              this is handling bubbled events from the inner overlay
              see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
            */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
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
