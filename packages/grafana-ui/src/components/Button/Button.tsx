import { type ButtonHTMLAttributes } from 'react';
import * as React from 'react';

import { type IconName } from '../../types/icon';
import { type ComponentSize } from '../../types/size';
import { type IconElementProps } from '../AbstractButton/AbstractButton';
import { type PopoverContent, type TooltipPlacement } from '../Tooltip/types';

import { StyledButton } from './StyledButton';

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
  ({ fill = 'solid', variant = fill === 'text' ? 'accent' : 'primary', ...props }, ref) => {
    return <StyledButton ref={ref} fill={fill} variant={variant} {...props} />;
  }
);

Button.displayName = 'Button';
