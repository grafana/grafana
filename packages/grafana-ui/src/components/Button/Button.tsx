import { cx } from '@emotion/css';
import { type ButtonHTMLAttributes } from 'react';
import * as React from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { type ComponentSize } from '../../types/size';
import { AbstractButton, type IconElementProps } from '../AbstractButton/AbstractButton';
import { type PopoverContent, type TooltipPlacement } from '../Tooltip/types';

import { getButtonStyles } from './Button.styles';

// TODO: move to a status type shared with Alert's AlertVariant, where 'danger' replaces 'destructive' here and 'error' there.
export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'success' | 'warning' | 'info';
export const allButtonVariants: ButtonVariant[] = [
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
];
export type ButtonFill = 'solid' | 'outline' | 'text';
export const allButtonFills: ButtonFill[] = ['solid', 'outline', 'text'];

type BaseProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  fill?: ButtonFill;
  icon?: IconName | React.ReactElement<IconElementProps>;
  className?: string;
  fullWidth?: boolean;
  type?: string;
  tooltip?: PopoverContent;
  tooltipPlacement?: TooltipPlacement;
  /** Position of the icon */
  iconPlacement?: 'left' | 'right';
};

// either aria-label or tooltip is required for buttons without children
type NoChildrenAriaLabel = BaseProps & {
  children?: never;
  'aria-label': string;
};
type NoChildrenTooltip = BaseProps & {
  children?: never;
  tooltip: PopoverContent;
  tooltipPlacement?: TooltipPlacement;
};

type BasePropsWithChildren = BaseProps & {
  children: React.ReactNode;
};

type CommonProps = BasePropsWithChildren | NoChildrenTooltip | NoChildrenAriaLabel;

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-button--docs
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      size = 'md',
      fill = 'solid',
      variant = fill === 'text' ? 'accent' : 'primary',
      icon,
      fullWidth,
      children,
      className,
      type = 'button',
      tooltip,
      disabled,
      tooltipPlacement,
      iconPlacement = 'left',
      onClick,
      ...otherProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      size,
      variant,
      fill,
      fullWidth,
      iconOnly: !children,
    });

    return (
      <AbstractButton
        ref={ref}
        className={cx(styles.button, { [styles.disabled]: disabled }, className)}
        icon={icon}
        iconSize={size}
        iconPlacement={iconPlacement}
        iconClassName={styles.icon}
        contentClassName={styles.content}
        tooltip={tooltip}
        tooltipPlacement={tooltipPlacement}
        disabled={disabled}
        aria-label={ariaLabel}
        type={type}
        onClick={onClick}
        {...otherProps}
      >
        {children}
      </AbstractButton>
    );
  }
);

Button.displayName = 'Button';
