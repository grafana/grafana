import { css, cx } from '@emotion/css';
import { Placement } from '@popperjs/core';
import React, { useCallback, useEffect, useRef } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { buildTooltipTheme } from '../../utils/tooltipUtils';
import { IconButton } from '../IconButton/IconButton';
import { Portal } from '../Portal/Portal';

import { ToggletipContent } from './types';

export interface ToggletipProps {
  /** The theme used to display the toggletip */
  theme?: 'info' | 'error';
  /** The title to be displayed on the header */
  title?: JSX.Element | string;
  /** determine whether to show or not the close button **/
  closeButton?: boolean;
  /** Callback function to be called when the toggletip is closed */
  onClose?: Function;
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
  }: ToggletipProps) => {
    const styles = useStyles2(getStyles);
    const style = styles[theme];
    const contentRef = useRef(null);
    const [controlledVisible, setControlledVisible] = React.useState(false);

    const closeToggletip = useCallback(() => {
      setControlledVisible(false);
      onClose?.();
    }, [onClose]);

    useEffect(() => {
      if (controlledVisible) {
        const handleKeyDown = (enterKey: KeyboardEvent) => {
          if (enterKey.key === 'Escape') {
            closeToggletip();
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
        };
      }
      return;
    }, [controlledVisible, closeToggletip]);

    const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible, update } = usePopperTooltip({
      visible: controlledVisible,
      placement: placement,
      interactive: true,
      offset: [0, 8],
      trigger: 'click',
      onVisibleChange: (value: boolean) => {
        setControlledVisible(value);
        if (!value) {
          onClose?.();
        }
      },
    });

    return (
      <>
        {React.cloneElement(children, {
          ref: setTriggerRef,
          tabIndex: 0,
        })}
        {visible && (
          <Portal>
            <div
              data-testid="toggletip-content"
              ref={setTooltipRef}
              {...getTooltipProps({ className: cx(style.container, fitContent && styles.fitContent) })}
            >
              {Boolean(title) && <div className={style.header}>{title}</div>}
              {closeButton && (
                <div className={style.headerClose}>
                  <IconButton
                    tooltip="Close"
                    name="times"
                    data-testid="toggletip-header-close"
                    onClick={closeToggletip}
                  />
                </div>
              )}
              <div ref={contentRef} {...getArrowProps({ className: style.arrow })} />
              <div className={style.body}>
                {(typeof content === 'string' || React.isValidElement(content)) && content}
                {typeof content === 'function' && update && content({ update })}
              </div>
              {Boolean(footer) && <div className={style.footer}>{footer}</div>}
            </div>
          </Portal>
        )}
      </>
    );
  }
);

Toggletip.displayName = 'Toggletip';

export const getStyles = (theme: GrafanaTheme2) => {
  const info = buildTooltipTheme(
    theme,
    theme.components.tooltip.background,
    theme.components.tooltip.background,
    theme.components.tooltip.text,
    { topBottom: 3, rightLeft: 3 }
  );
  const error = buildTooltipTheme(
    theme,
    theme.colors.error.main,
    theme.colors.error.main,
    theme.colors.error.contrastText,
    { topBottom: 3, rightLeft: 3 }
  );

  return {
    info,
    error,
    fitContent: css`
      max-width: fit-content;
    `,
  };
};
