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

const getStyles = stylesFactory((theme: GrafanaTheme2, size, variant: IconButtonVariant) => {
  const padding = (size: string) => {
    switch (size) {
      case 'xs':
        return 4;

      case 'sm':
        return 4; // TODO: ask Staton

      case 'lg':
        return 6; // TODO: ask Staton

      case 'xl':
        return 12;

      case 'xxl':
        return 12; // TODO: ask Staton

      case 'xxxl':
        return 12; // TODO: ask Staton

      case 'md':
      default:
        return 6;
    }
  };

  // overall size of the IconButton on hover
  const hoverSize = getSvgSize(size) + 2 * padding(size);

  let iconColor = theme.colors.text.primary;

  if (variant === 'primary') {
    iconColor = theme.colors.primary.text;
  } else if (variant === 'destructive') {
    iconColor = theme.colors.error.text;
  }

  return {
    button: css`
      z-index: 0;
      position: relative;
      margin: 0 ${theme.spacing(0.5)} 0 0;
      box-shadow: none;
      border: none;
      display: inline-flex;
      background: transparent;
      justify-content: center;
      align-items: center;
      padding: 0;
      color: ${iconColor};

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        color: ${theme.colors.action.disabledText};
        opacity: 0.65;
      }

      &:before {
        z-index: -1;
        position: absolute;
        width: ${hoverSize}px;
        height: ${hoverSize}px;
        border-radius: ${theme.shape.radius.default};
        content: '';
        transition-duration: 0.2s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
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
        &:before {
          background-color: ${variant === 'secondary'
            ? theme.colors.action.hover
            : colorManipulator.alpha(iconColor, 0.12)};
        }
      }
    `,
    icon: css`
      vertical-align: baseline;
    `,
  };
});
