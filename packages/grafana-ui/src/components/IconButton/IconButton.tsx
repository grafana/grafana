import React from 'react';
import { Icon, getSvgSize } from '../Icon/Icon';
import { IconName, IconSize, IconType } from '../../types/icon';
import { stylesFactory } from '../../themes/stylesFactory';
import { css, cx } from 'emotion';
import { useTheme } from '../../themes/ThemeContext';
import { GrafanaTheme } from '@grafana/data';
import { Tooltip } from '../Tooltip/Tooltip';
import { TooltipPlacement } from '../Tooltip/PopoverController';

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Name of the icon **/
  name: IconName;
  /** Icon size */
  size?: IconSize;
  /** Need this to change hover effect based on what surface it is on */
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
  ({ name, size = 'md', surface = 'panel', iconType, tooltip, tooltipPlacement, className, ...restProps }, ref) => {
    const theme = useTheme();
    const styles = getStyles(theme, surface, size);

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

function getHoverColor(theme: GrafanaTheme, surface: SurfaceType): string {
  switch (surface) {
    case 'dashboard':
      return theme.isLight ? theme.palette.gray95 : theme.palette.gray15;
    case 'panel':
      return theme.isLight ? theme.palette.gray6 : theme.palette.gray15;
    case 'header':
      return theme.isLight ? theme.colors.bg3 : theme.palette.gray25;
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme, surface: SurfaceType, size: IconSize) => {
  const hoverColor = getHoverColor(theme, surface);
  const pixelSize = getSvgSize(size);

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
        bottom: -8px;
        left: -8px;
        right: -8px;
        top: -8px;
        background: none;
        border-radius: 50%;
        box-sizing: border-box;
        transform: scale(0);
        transition-property: transform, opacity;
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
