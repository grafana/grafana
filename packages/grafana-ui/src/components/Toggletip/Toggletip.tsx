import { css, cx } from '@emotion/css';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingArrow,
  FloatingFocusManager,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { Placement } from '@popperjs/core';
import React, { useRef, useState } from 'react';
import { GrafanaTheme3 } from 'src/saga-themes/createTheme';

import { useStyles3, useTheme3 } from '../../themes/ThemeContext';
import { buildTooltipTheme, getPlacement } from '../../utils/tooltipUtils';
import { IconButton } from '../IconButton/IconButton';

import { ToggletipContent } from './types';

export interface ToggletipProps {
  /** The theme used to display the toggletip */
  theme?: 'info' | 'error';
  /** The title to be displayed on the header */
  title?: JSX.Element | string;
  /** determine whether to show or not the close button **/
  closeButton?: boolean;
  /** Callback function to be called when the toggletip is closed */
  onClose?: () => void;
  /** The preferred placement of the toggletip */
  placement?: Placement;
  /** The text or component that houses the content of the toggleltip */
  content: ToggletipContent;
  /** The text or component to be displayed on the toggletip's bottom */
  footer?: JSX.Element | string;
  /** The UI control users interact with to display toggletips */
  children: JSX.Element;
  /** Determine whether the toggletip should fit its content or not */
  fitContent?: boolean;
  /** Determine whether the toggletip should be shown or not */
  show?: boolean;
  /** Callback function to be called when the toggletip is opened */
  onOpen?: () => void;
}

export const Toggletip = React.memo(
  ({
    children,
    theme = 'info',
    placement = 'auto',
    content,
    title,
    closeButton = true,
    onClose,
    footer,
    fitContent = false,
    onOpen,
    show,
  }: ToggletipProps) => {
    const arrowRef = useRef(null);
    const grafanaTheme = useTheme3();
    const styles = useStyles3(getStyles);
    const style = styles[theme];
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
      onOpenChange: (open) => {
        if (show === undefined) {
          setControlledVisible(open);
        }
        if (!open) {
          onClose?.();
        } else {
          onOpen?.();
        }
      },
      middleware,
      whileElementsMounted: autoUpdate,
      strategy: 'fixed',
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, click]);

    return (
      <>
        {React.cloneElement(children, {
          ref: refs.setReference,
          tabIndex: 0,
          'aria-expanded': isOpen,
          ...getReferenceProps(),
        })}
        {isOpen && (
          <FloatingFocusManager context={context} modal={false} closeOnFocusOut={false}>
            <div
              data-testid="toggletip-content"
              className={cx(style.container, {
                [styles.fitContent]: fitContent,
              })}
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <FloatingArrow
                strokeWidth={0.3}
                stroke={grafanaTheme.color.border.ui.weak}
                className={style.arrow}
                ref={arrowRef}
                context={context}
              />
              {Boolean(title) && <div className={style.header}>{title}</div>}
              {closeButton && (
                <div className={style.headerClose}>
                  <IconButton
                    aria-label="Close"
                    name="times"
                    data-testid="toggletip-header-close"
                    onClick={() => {
                      setControlledVisible(false);
                      onClose?.();
                    }}
                  />
                </div>
              )}
              <div className={style.body}>
                {(typeof content === 'string' || React.isValidElement(content)) && content}
                {typeof content === 'function' && content({})}
              </div>
              {Boolean(footer) && <div className={style.footer}>{footer}</div>}
            </div>
          </FloatingFocusManager>
        )}
      </>
    );
  }
);

Toggletip.displayName = 'Toggletip';

export const getStyles = (theme: GrafanaTheme3) => {
  const info = buildTooltipTheme(
    theme,
    theme.color.background.ui.primary,
    theme.color.border.ui.weak,
    theme.color.content.secondary,
    { topBottom: 200, rightLeft: 200 }
  );
  const error = buildTooltipTheme(
    theme,
    // TODO: Should be a background color
    theme.color.border.system.error,
    theme.color.border.system.error,
    theme.color.content.primary,
    { topBottom: 200, rightLeft: 200 }
  );

  return {
    info,
    error,
    fitContent: css({
      maxWidth: 'fit-content',
    }),
  };
};
