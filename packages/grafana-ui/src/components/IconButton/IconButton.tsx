import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { stylesFactory } from '../../themes/stylesFactory';
import { IconName, IconSize, IconType } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { getSvgSize } from '../Icon/utils';
import { TooltipPlacement, PopoverContent, Tooltip } from '../Tooltip';

export type IconButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Name of the icon **/
  name: IconName;
  /** Icon size */
  size?: IconSize;
  /** Type of the icon - mono or default */
  iconType?: IconType;
  /** Tooltip content to display on hover */
  tooltip?: PopoverContent;
  /** Position of the tooltip */
  tooltipPlacement?: TooltipPlacement;
  /** Variant to change the color of the Icon */
  variant?: IconButtonVariant;
  /** Text avilable ony for screenscreen readers. Will use tooltip text as fallback. */
  ariaLabel?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, Props>(
  (
    {
      name,
      size = 'md',
      iconType,
      tooltip,
      tooltipPlacement,
      ariaLabel,
      className,
      variant = 'secondary',
      ...restProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getStyles(theme, size, variant);
    const tooltipString = typeof tooltip === 'string' ? tooltip : '';

    const button = (
      <button ref={ref} aria-label={ariaLabel || tooltipString} {...restProps} className={cx(styles.button, className)}>
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

const getStyles = stylesFactory((theme: GrafanaTheme2, size: IconSize, variant: IconButtonVariant) => {
  const pixelSize = getSvgSize(size);
  const hoverSize = Math.max(pixelSize / 3, 8);
  let iconColor = theme.colors.text.primary;

  if (variant === 'primary') {
    iconColor = theme.colors.primary.text;
  } else if (variant === 'destructive') {
    iconColor = theme.colors.error.text;
  }

  return {
    button: css`
      width: ${pixelSize}px;
      height: ${pixelSize}px;
      background: transparent;
      border: none;
      color: ${iconColor};
      padding: 0;
      margin: 0;
      outline: none;
      box-shadow: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-radius: ${theme.shape.borderRadius()};
      z-index: 0;
      margin-right: ${theme.spacing(0.5)};

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        color: ${theme.colors.action.disabledText};
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
        ${getFocusStyles(theme)}
      }

      &:focus:not(:focus-visible) {
        ${getMouseFocusStyles(theme)}
      }

      &:hover {
        color: ${iconColor};

        &:before {
          background-color: ${variant === 'secondary'
            ? theme.colors.action.hover
            : colorManipulator.alpha(iconColor, 0.12)};
          border: none;
          box-shadow: none;
          opacity: 1;
          transform: scale(0.8);
        }
      }
    `,
    icon: css`
      vertical-align: baseline;
      display: flex;
    `,
  };
});
