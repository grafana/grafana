import { css, CSSObject, cx } from '@emotion/css';
import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

import { GrafanaTheme2, ThemeRichColor } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { ComponentSize } from '../../types';
import { IconName } from '../../types/icon';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { Icon } from '../Icon/Icon';
import { PopoverContent, Tooltip, TooltipPlacement } from '../Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'success';
export const allButtonVariants: ButtonVariant[] = ['primary', 'secondary', 'destructive'];
export type ButtonFill = 'solid' | 'outline' | 'text';
export const allButtonFills: ButtonFill[] = ['solid', 'outline', 'text'];

type CommonProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  fill?: ButtonFill;
  icon?: IconName;
  className?: string;
  children?: React.ReactNode;
  fullWidth?: boolean;
  type?: string;
  /** Tooltip content to display on hover */
  tooltip?: PopoverContent;
  /** Position of the tooltip */
  tooltipPlacement?: TooltipPlacement;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fill = 'solid',
      icon,
      fullWidth,
      children,
      className,
      type = 'button',
      tooltip,
      tooltipPlacement,
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

    // In order to standardise Button please always consider using IconButton when you need a button with an icon only
    // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
    const button = (
      <button className={cx(styles.button, className)} type={type} {...otherProps} ref={tooltip ? undefined : ref}>
        {icon && <Icon name={icon} size={size} className={styles.icon} />}
        {children && <span className={styles.content}>{children}</span>}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

Button.displayName = 'Button';

type ButtonLinkProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>;

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fill = 'solid',
      icon,
      fullWidth,
      children,
      className,
      onBlur,
      onFocus,
      disabled,
      tooltip,
      tooltipPlacement,
      ...otherProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      fullWidth,
      size,
      variant,
      fill,
      iconOnly: !children,
    });

    const linkButtonStyles = cx(
      styles.button,
      {
        [css(styles.disabled, {
          pointerEvents: 'none',
        })]: disabled,
      },
      className
    );

    // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
    const button = (
      <a className={linkButtonStyles} {...otherProps} tabIndex={disabled ? -1 : 0} ref={tooltip ? undefined : ref}>
        {icon && <Icon name={icon} size={size} className={styles.icon} />}
        {children && <span className={styles.content}>{children}</span>}
      </a>
    );

    if (tooltip) {
      return (
        <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

LinkButton.displayName = 'LinkButton';

export interface StyleProps {
  size: ComponentSize;
  variant: ButtonVariant;
  fill?: ButtonFill;
  iconOnly?: boolean;
  theme: GrafanaTheme2;
  fullWidth?: boolean;
  narrow?: boolean;
}

export const getButtonStyles = (props: StyleProps) => {
  const { theme, variant, fill = 'solid', size, iconOnly, fullWidth } = props;
  const { height, padding, fontSize } = getPropertiesForButtonSize(size, theme);
  const variantStyles = getPropertiesForVariant(theme, variant, fill);
  const disabledStyles = getPropertiesForDisabled(theme, variant, fill);
  const focusStyle = getFocusStyles(theme);
  const paddingMinusBorder = theme.spacing.gridSize * padding - 1;

  return {
    button: css({
      label: 'button',
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamily,
      padding: `0 ${paddingMinusBorder}px`,
      height: theme.spacing(height),
      // Deduct border from line-height for perfect vertical centering on windows and linux
      lineHeight: `${theme.spacing.gridSize * height - 2}px`,
      verticalAlign: 'middle',
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:focus': focusStyle,
      '&:focus-visible': focusStyle,
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
      ...(fullWidth && {
        flexGrow: 1,
        justifyContent: 'center',
      }),
      ...variantStyles,
      ':disabled': disabledStyles,
      '&[disabled]': disabledStyles,
    }),
    disabled: css(disabledStyles),
    img: css`
      width: 16px;
      height: 16px;
      margin: ${theme.spacing(0, 1, 0, 0.5)};
    `,
    icon: iconOnly
      ? css({
          // Important not to set margin bottom here as it would override internal icon bottom margin
          marginRight: theme.spacing(-padding / 2),
          marginLeft: theme.spacing(-padding / 2),
        })
      : css({
          marginRight: theme.spacing(padding / 2),
        }),
    content: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      white-space: nowrap;
      height: 100%;
    `,
  };
};

function getButtonVariantStyles(theme: GrafanaTheme2, color: ThemeRichColor, fill: ButtonFill): CSSObject {
  let outlineBorderColor = color.border;
  let borderColor = 'transparent';
  let hoverBorderColor = 'transparent';

  // Secondary button has some special rules as we lack theem color token to
  // specify border color for normal button vs border color for outline button
  if (color.name === 'secondary') {
    borderColor = color.border;
    hoverBorderColor = theme.colors.emphasize(color.border, 0.25);
    outlineBorderColor = theme.colors.border.strong;
  }

  if (fill === 'outline') {
    return {
      background: 'transparent',
      color: color.text,
      border: `1px solid ${outlineBorderColor}`,
      transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),

      '&:hover': {
        background: color.transparent,
        borderColor: theme.colors.emphasize(outlineBorderColor, 0.25),
        color: color.text,
      },
    };
  }

  if (fill === 'text') {
    return {
      background: 'transparent',
      color: color.text,
      border: '1px solid transparent',
      transition: theme.transitions.create(['background-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),

      '&:focus': {
        outline: 'none',
        textDecoration: 'none',
      },

      '&:hover': {
        background: color.transparent,
        textDecoration: 'none',
      },
    };
  }

  return {
    background: color.main,
    color: color.contrastText,
    border: `1px solid ${borderColor}`,
    transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
      duration: theme.transitions.duration.short,
    }),

    '&:hover': {
      background: color.shade,
      color: color.contrastText,
      boxShadow: theme.shadows.z1,
      borderColor: hoverBorderColor,
    },
  };
}

function getPropertiesForDisabled(theme: GrafanaTheme2, variant: ButtonVariant, fill: ButtonFill) {
  const disabledStyles: CSSObject = {
    cursor: 'not-allowed',
    boxShadow: 'none',
    color: theme.colors.text.disabled,
    transition: 'none',
  };

  if (fill === 'text') {
    return {
      ...disabledStyles,
      background: 'transparent',
      border: `1px solid transparent`,
    };
  }

  if (fill === 'outline') {
    return {
      ...disabledStyles,
      background: 'transparent',
      border: `1px solid ${theme.colors.border.weak}`,
    };
  }

  return {
    ...disabledStyles,
    background: theme.colors.action.disabledBackground,
    border: `1px solid transparent`,
  };
}

export function getPropertiesForVariant(theme: GrafanaTheme2, variant: ButtonVariant, fill: ButtonFill) {
  switch (variant) {
    case 'secondary':
      // The seconday button has some special handling as it's outline border is it's default color border
      return getButtonVariantStyles(theme, theme.colors.secondary, fill);

    case 'destructive':
      return getButtonVariantStyles(theme, theme.colors.error, fill);

    case 'success':
      return getButtonVariantStyles(theme, theme.colors.success, fill);

    case 'primary':
    default:
      return getButtonVariantStyles(theme, theme.colors.primary, fill);
  }
}

export const clearButtonStyles = (theme: GrafanaTheme2) => {
  return css`
    background: transparent;
    color: ${theme.colors.text.primary};
    border: none;
    padding: 0;
  `;
};

export const clearLinkButtonStyles = (theme: GrafanaTheme2) => {
  return css`
    background: transparent;
    border: none;
    padding: 0;
    font-family: inherit;
    color: inherit;
    height: 100%;
    &:hover {
      background: transparent;
      color: inherit;
    }
  `;
};
