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
  safePolygon,
} from '@floating-ui/react';
import { forwardRef, cloneElement, isValidElement, useCallback, useId, useRef, useState } from 'react';

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

export const Tooltip = forwardRef<HTMLElement, TooltipProps>(
  ({ children, theme, interactive, show, placement, content }, forwardedRef) => {
    const arrowRef = useRef(null);
    const [controlledVisible, setControlledVisible] = useState(show);
    const isOpen = show ?? controlledVisible;

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
      arrow({
        element: arrowRef,
      }),
    ];

    const { context, refs, floatingStyles } = useFloating({
      open: isOpen,
      placement: getPlacement(placement),
      onOpenChange: setControlledVisible,
      middleware,
      whileElementsMounted: autoUpdate,
    });
    const tooltipId = useId();

    const hover = useHover(context, {
      handleClose: interactive ? safePolygon() : undefined,
      move: false,
    });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, hover, focus]);

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

    // if the child has a matching aria-label, this should take precedence over the tooltip content
    // otherwise we end up double announcing things in e.g. IconButton
    const childHasMatchingAriaLabel = 'aria-label' in children.props && children.props['aria-label'] === content;

    return (
      <>
        {cloneElement(children, {
          ref: handleRef,
          tabIndex: 0, // tooltip trigger should be keyboard focusable
          'aria-describedby': !childHasMatchingAriaLabel && isOpen ? tooltipId : undefined,
          ...getReferenceProps(),
        })}
        {isOpen && (
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
                {isValidElement(content) && cloneElement(content)}
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
