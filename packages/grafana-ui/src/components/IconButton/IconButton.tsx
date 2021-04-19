import React from 'react';
import { Icon, getSvgSize } from '../Icon/Icon';
import { IconName, IconSize, IconType } from '../../types/icon';
import { stylesFactory } from '../../themes/stylesFactory';
import { css, cx } from '@emotion/css';
import { useTheme } from '../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';
import { Tooltip } from '../Tooltip/Tooltip';
import { TooltipPlacement } from '../Tooltip/PopoverController';
import { focusCss, getMouseFocusStyles } from '../../themes/mixins';

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Name of the icon **/
  name: IconName;
  /** Icon size */
  size?: IconSize;
  /** @deprecated */
  surface?: SurfaceType;
  /** Type od the icon - mono or default */
  iconType?: IconType;
  /** Tooltip content to display on hover */
  tooltip?: string;
  /** Position of the tooltip */
  tooltipPlacement?: TooltipPlacement;
}

type SurfaceType = 'dashboard' | 'panel' | 'header';

export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ name, size = 'md', iconType, tooltip, tooltipPlacement, className, ...restProps }, ref) => {
    const theme = useTheme();
    const styles = getStyles(theme, size);

    const button = (
      <button ref={ref} {...restProps} className={cx(styles.button, className)}>
        <Icon name={name} size={size} className={styles.icon} type={iconType} />
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip content={tooltip} placement={tooltipPlacement}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

IconButton.displayName = 'IconButton';

const getStyles = stylesFactory((theme: GrafanaTheme, size: IconSize) => {
  const hoverColor = theme.v2.palette.action.hover;
  const pixelSize = getSvgSize(size);
  const hoverSize = pixelSize / 2;

  return {
    button: css`
      width: ${pixelSize}px;
      height: ${pixelSize}px;
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      outline: none;
      box-shadow: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-radius: ${theme.v2.shape.borderRadius()};
      z-index: 0;
      margin-right: ${theme.spacing.xs};

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        opacity: 0.65;
        box-shadow: none;
      }

      &:before {
        content: '';
        display: block;
        opacity: 1;
        position: absolute;
        transition-duration: 0.2s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        z-index: -1;
        bottom: -${hoverSize}px;
        left: -${hoverSize}px;
        right: -${hoverSize}px;
        top: -${hoverSize}px;
        background: none;
        border-radius: 50%;
        box-sizing: border-box;
        transform: scale(0);
        transition-property: transform, opacity;
      }

      &:focus,
      &:focus-visible {
        ${focusCss(theme)}
      }

      &:focus:not(:focus-visible) {
        ${getMouseFocusStyles(theme.v2)}
      }

      &:hover {
        color: ${theme.colors.linkHover};

        &:before {
          background-color: ${hoverColor};
          border: none;
          box-shadow: none;
          opacity: 1;
          transform: scale(0.8);
        }
      }
    `,
    icon: css`
      margin-bottom: 0;
      vertical-align: baseline;
      display: flex;
    `,
  };
});
