import { css } from '@emotion/css';
import { Placement } from '@popperjs/core';
import React, { useCallback, useEffect, useRef } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
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
              {...getTooltipProps({ className: style.container })}
            >
              {Boolean(title) && <div className={style.header}>{title}</div>}
              {closeButton && (
                <div data-testid="toggletip-header-close" className={style.headerClose}>
                  <IconButton aria-label="Close Toggletip" name="times" size="md" onClick={closeToggletip} />
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

function getStyles(theme: GrafanaTheme2) {
  function buildToggletipTheme(toggletipBg: string, toggletipBorder: string, toggletipText: string) {
    return {
      arrow: css`
        height: 1rem;
        width: 1rem;
        position: absolute;
        pointer-events: none;

        &::before {
          border-style: solid;
          content: '';
          display: block;
          height: 0;
          margin: auto;
          width: 0;
        }

        &::after {
          border-style: solid;
          content: '';
          display: block;
          height: 0;
          margin: auto;
          position: absolute;
          width: 0;
        }
      `,
      container: css`
        background-color: ${toggletipBg};
        border-radius: 3px;
        border: 1px solid ${toggletipBorder};
        box-shadow: ${theme.shadows.z2};
        color: ${toggletipText};
        font-size: ${theme.typography.bodySmall.fontSize};
        padding: ${theme.spacing(3, 3)};
        transition: opacity 0.3s;
        z-index: ${theme.zIndex.tooltip};
        max-width: 400px;
        overflow-wrap: break-word;

        &[data-popper-interactive='false'] {
          pointer-events: none;
        }

        &[data-popper-placement*='bottom'] > div[data-popper-arrow='true'] {
          left: 0;
          margin-top: -7px;
          top: 0;

          &::before {
            border-color: transparent transparent ${toggletipBorder} transparent;
            border-width: 0 8px 7px 8px;
            position: absolute;
            top: -1px;
          }

          &::after {
            border-color: transparent transparent ${toggletipBg} transparent;
            border-width: 0 8px 7px 8px;
          }
        }

        &[data-popper-placement*='top'] > div[data-popper-arrow='true'] {
          bottom: 0;
          left: 0;
          margin-bottom: -14px;

          &::before {
            border-color: ${toggletipBorder} transparent transparent transparent;
            border-width: 7px 8px 0 7px;
            position: absolute;
            top: 1px;
          }

          &::after {
            border-color: ${toggletipBg} transparent transparent transparent;
            border-width: 7px 8px 0 7px;
          }
        }

        &[data-popper-placement*='right'] > div[data-popper-arrow='true'] {
          left: 0;
          margin-left: -11px;

          &::before {
            border-color: transparent ${toggletipBorder} transparent transparent;
            border-width: 7px 6px 7px 0;
          }

          &::after {
            border-color: transparent ${toggletipBg} transparent transparent;
            border-width: 6px 7px 7px 0;
            left: 2px;
            top: 1px;
          }
        }

        &[data-popper-placement*='left'] > div[data-popper-arrow='true'] {
          margin-right: -11px;
          right: 0;

          &::before {
            border-color: transparent transparent transparent ${toggletipBorder};
            border-width: 7px 0 6px 7px;
          }

          &::after {
            border-color: transparent transparent transparent ${toggletipBg};
            border-width: 6px 0 5px 5px;
            left: 1px;
            top: 1px;
          }
        }

        code {
          border: none;
          display: inline;
          background: ${colorManipulator.darken(toggletipBg, 0.1)};
          color: ${toggletipText};
        }

        pre {
          background: ${colorManipulator.darken(toggletipBg, 0.1)};
          color: ${toggletipText};
        }

        a {
          color: ${toggletipText};
          text-decoration: underline;
        }

        a:hover {
          text-decoration: none;
        }
      `,
      headerClose: css`
        color: ${theme.colors.text.secondary};
        position: absolute;
        right: ${theme.spacing(1)};
        top: ${theme.spacing(1)};
        background-color: transparent;
        border: 0;
      `,
      header: css`
        padding-top: ${theme.spacing(1)};
        padding-bottom: ${theme.spacing(2)};
      `,
      body: css`
        padding-top: ${theme.spacing(1)};
        padding-bottom: ${theme.spacing(1)};
      `,
      footer: css`
        padding-top: ${theme.spacing(2)};
        padding-bottom: ${theme.spacing(1)};
      `,
    };
  }

  const info = buildToggletipTheme(
    theme.components.tooltip.background,
    theme.components.tooltip.background,
    theme.components.tooltip.text
  );
  const error = buildToggletipTheme(theme.colors.error.main, theme.colors.error.main, theme.colors.error.contrastText);

  return {
    info,
    error,
  };
}
