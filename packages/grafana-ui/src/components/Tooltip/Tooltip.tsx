import {
  arrow,
  autoUpdate,
  flip,
  FloatingArrow,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
} from '@floating-ui/react';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { buildTooltipTheme, getPlacement } from '../../utils/tooltipUtils';
import { Portal } from '../Portal/Portal';

import { PopoverContent, TooltipPlacement } from './types';

export interface TooltipProps {
  theme?: 'info' | 'error' | 'info-alt';
  show?: boolean;
  placement?: TooltipPlacement;
  content: PopoverContent;
  children: JSX.Element;
  /**
   * Set to true if you want the tooltip to stay long enough so the user can move mouse over content to select text or click a link
   */
  interactive?: boolean;
}

export const Tooltip = React.forwardRef<HTMLElement, TooltipProps>(
  ({ children, theme, interactive, show, placement, content }, forwardedRef) => {
    const arrowRef = useRef(null);
    const [controlledVisible, setControlledVisible] = useState(show);

    // the order of middleware is important!
    // `arrow` should almost always be at the end
    // see https://floating-ui.com/docs/arrow#order
    const middleware = [
      offset(8),
      flip({
        fallbackAxisSideDirection: 'end',
        // see https://floating-ui.com/docs/flip#combining-with-shift
        crossAxis: false,
      }),
      shift(),
      arrow({
        element: arrowRef,
      }),
    ];

    const { context, refs, floatingStyles } = useFloating({
      open: show ?? controlledVisible,
      placement: getPlacement(placement),
      onOpenChange: setControlledVisible,
      middleware,
      whileElementsMounted: autoUpdate,
    });
    const tooltipId = useId();

    const hover = useHover(context, {
      delay: {
        close: interactive ? 100 : 0,
      },
    });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);

    const interactions = [hover, focus];

    if (interactive) {
      interactions.push(dismiss);
    }

    const { getReferenceProps, getFloatingProps } = useInteractions(interactions);

    useEffect(() => {
      if (controlledVisible !== false) {
        const handleKeyDown = (enterKey: KeyboardEvent) => {
          if (enterKey.key === 'Escape') {
            setControlledVisible(false);
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
        };
      } else {
        return;
      }
    }, [controlledVisible]);

    const contentIsFunction = typeof content === 'function';

    const styles = useStyles2(getStyles);
    const style = styles[theme ?? 'info'];

    const handleRef = useCallback(
      (ref: HTMLElement | null) => {
        refs.setReference(ref);

        if (typeof forwardedRef === 'function') {
          forwardedRef(ref);
        } else if (forwardedRef) {
          forwardedRef.current = ref;
        }
      },
      [forwardedRef, refs]
    );

    return (
      <>
        {React.cloneElement(children, {
          ref: handleRef,
          tabIndex: 0, // tooltip trigger should be keyboard focusable
          'aria-describedby': controlledVisible ? tooltipId : undefined,
          ...getReferenceProps(),
        })}
        {controlledVisible && (
          <Portal>
            <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
              <FloatingArrow className={style.arrow} ref={arrowRef} context={context} />
              <div
                data-testid={selectors.components.Tooltip.container}
                id={tooltipId}
                role="tooltip"
                className={style.container}
              >
                {typeof content === 'string' && content}
                {React.isValidElement(content) && React.cloneElement(content)}
                {contentIsFunction && content({})}
              </div>
            </div>
          </Portal>
        )}
      </>
    );
  }
);

Tooltip.displayName = 'Tooltip';

export const getStyles = (theme: GrafanaTheme2) => {
  const info = buildTooltipTheme(
    theme,
    theme.components.tooltip.background,
    theme.components.tooltip.background,
    theme.components.tooltip.text,
    { topBottom: 0.5, rightLeft: 1 }
  );
  const error = buildTooltipTheme(
    theme,
    theme.colors.error.main,
    theme.colors.error.main,
    theme.colors.error.contrastText,
    { topBottom: 0.5, rightLeft: 1 }
  );

  return {
    info,
    ['info-alt']: info,
    error,
  };
};
