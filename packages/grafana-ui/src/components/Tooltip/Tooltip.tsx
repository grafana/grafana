import React from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes/ThemeContext';
import { PopoverContent, TooltipPlacement } from './types';
import { Portal } from '../Portal/Portal';

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

export const Tooltip = React.memo(({ children, theme, interactive, show, placement, content }: TooltipProps) => {
  const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible, update } = usePopperTooltip({
    visible: show,
    placement: placement,
    interactive: interactive,
    delayHide: interactive ? 100 : 0,
    delayShow: 50,
    // Focus is new, old tooltip did not show on focus, we could make this a parameter/option?
    trigger: ['hover', 'focus'],
  });

  const styles = useStyles2(getStyles);
  const containerStyle = styles[theme ?? 'info'];

  return (
    <>
      {React.cloneElement(children, {
        ref: setTriggerRef,
      })}
      {visible && (
        <Portal>
          <div ref={setTooltipRef} {...getTooltipProps({ className: containerStyle })}>
            <div {...getArrowProps({ className: 'tooltip-arrow' })} />
            {typeof content === 'string' && content}
            {React.isValidElement(content) && React.cloneElement(content)}
            {typeof content === 'function' &&
              content({
                updatePopperPosition: update as any,
              })}
          </div>
        </Portal>
      )}
    </>
  );
});

Tooltip.displayName = 'Tooltip';

function getStyles(theme: GrafanaTheme2) {
  function buildTooltipTheme(tooltipBg: string, tooltipBorder: string, tooltipText: string) {
    return css`
      background-color: ${tooltipBg};
      border-radius: 3px;
      border: 1px solid ${tooltipBorder};
      box-shadow: ${theme.shadows.z2};
      color: ${tooltipText};
      display: flex;
      font-size: ${theme.typography.bodySmall.fontSize};
      flex-direction: column;
      padding: ${theme.spacing(0.5, 1)};
      transition: opacity 0.3s;
      z-index: ${theme.zIndex.tooltip};
      max-width: 400px;

      &[data-popper-interactive='false'] {
        pointer-events: none;
      }

      .tooltip-arrow {
        height: 1rem;
        position: absolute;
        width: 1rem;
        pointer-events: none;
      }

      .tooltip-arrow::before {
        border-style: solid;
        content: '';
        display: block;
        height: 0;
        margin: auto;
        width: 0;
      }

      .tooltip-arrow::after {
        border-style: solid;
        content: '';
        display: block;
        height: 0;
        margin: auto;
        position: absolute;
        width: 0;
      }

      &[data-popper-placement*='bottom'] .tooltip-arrow {
        left: 0;
        margin-top: -0.4rem;
        top: 0;
      }

      &[data-popper-placement*='bottom'] .tooltip-arrow::before {
        border-color: transparent transparent ${tooltipBorder} transparent;
        border-width: 0 0.5rem 0.4rem 0.5rem;
        position: absolute;
        top: -1px;
      }

      &[data-popper-placement*='bottom'] .tooltip-arrow::after {
        border-color: transparent transparent ${tooltipBg} transparent;
        border-width: 0 0.5rem 0.4rem 0.5rem;
      }

      &[data-popper-placement*='top'] .tooltip-arrow {
        bottom: 0;
        left: 0;
        margin-bottom: -12px;
      }

      &[data-popper-placement*='top'] .tooltip-arrow::before {
        border-color: ${tooltipBorder} transparent transparent transparent;
        border-width: 0.4rem 0.5rem 0 0.5rem;
        position: absolute;
        top: 1px;
      }

      &[data-popper-placement*='top'] .tooltip-arrow::after {
        border-color: ${tooltipBg} transparent transparent transparent;
        border-width: 0.4rem 0.5rem 0 0.5rem;
      }

      &[data-popper-placement*='right'] .tooltip-arrow {
        left: 0;
        margin-left: -0.7rem;
      }

      &[data-popper-placement*='right'] .tooltip-arrow::before {
        border-color: transparent ${tooltipBorder} transparent transparent;
        border-width: 0.5rem 0.4rem 0.5rem 0;
      }

      &[data-popper-placement*='right'] .tooltip-arrow::after {
        border-color: transparent ${tooltipBg} transparent transparent;
        border-width: 0.5rem 0.4rem 0.5rem 0;
        left: 6px;
        top: 0;
      }

      &[data-popper-placement*='left'] .tooltip-arrow {
        margin-right: -0.7rem;
        right: 0;
      }

      &[data-popper-placement*='left'] .tooltip-arrow::before {
        border-color: transparent transparent transparent ${tooltipBorder};
        border-width: 0.5rem 0 0.5rem 0.4em;
      }

      &[data-popper-placement*='left'] .tooltip-arrow::after {
        border-color: transparent transparent transparent ${tooltipBg};
        border-width: 0.5rem 0 0.5rem 0.4em;
        left: 3px;
        top: 0;
      }
    `;
  }

  const info = buildTooltipTheme(
    theme.components.tooltip.background,
    theme.components.tooltip.background,
    theme.components.tooltip.text
  );
  const error = buildTooltipTheme(theme.colors.error.main, theme.colors.error.main, theme.colors.error.contrastText);

  return {
    info: info,
    ['info-alt']: info,
    error,
  };
}
