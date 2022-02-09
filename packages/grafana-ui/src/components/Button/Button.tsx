import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { css, CSSObject, cx } from '@emotion/css';
import { useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { colorManipulator, GrafanaTheme2, ThemeRichColor } from '@grafana/data';
import { ComponentSize } from '../../types/size';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';
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
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fill = 'solid', icon, fullWidth, children, className, ...otherProps }, ref) => {
    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      size,
      variant,
      fill,
      fullWidth,
      iconOnly: !children,
    });

    deprecatedPropWarning(
      variant === 'link',
      `${Button.displayName}: Prop variant="link" is deprecated. Please use fill="text".`
    );

    return (
      <button className={cx(styles.button, className)} {...otherProps} ref={ref}>
        {icon && <Icon name={icon} size={size} className={styles.icon} />}
        {children && <span className={styles.content}>{children}</span>}
      </button>
    );
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

    deprecatedPropWarning(
      variant === 'link',
      `${LinkButton.displayName}: Prop variant="link" is deprecated. Please use fill="text".`
    );

    return (
      <a className={linkButtonStyles} {...otherProps} tabIndex={disabled ? -1 : 0} ref={ref}>
        {icon && <Icon name={icon} size={size} className={styles.icon} />}
        {children && <span className={styles.content}>{children}</span>}
      </a>
    );
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
      borderRadius: theme.shape.borderRadius(1),
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
  if (fill === 'outline') {
    return {
      background: 'transparent',
      color: color.text,
      border: `1px solid ${color.border}`,
      transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),

      '&:hover': {
        background: colorManipulator.alpha(color.main, theme.colors.action.hoverOpacity),
        borderColor: theme.colors.emphasize(color.border, 0.25),
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
        background: colorManipulator.alpha(color.shade, theme.colors.action.hoverOpacity),
        textDecoration: 'none',
      },
    };
  }

  return {
    background: color.main,
    color: color.contrastText,
    border: `1px solid transparent`,
    transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
      duration: theme.transitions.duration.short,
    }),

    '&:hover': {
      background: color.shade,
      color: color.contrastText,
      boxShadow: theme.shadows.z1,
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

  if (fill === 'text' || variant === 'link') {
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
      border: `1px solid ${theme.colors.action.disabledText}`,
    };
  }

  return {
    ...disabledStyles,
    background: theme.colors.action.disabledBackground,
    border: `1px solid transparent`,
  };
}

export function getPropertiesForVariant(theme: GrafanaTheme2, variant: ButtonVariant, fill: ButtonFill) {
  const buttonVariant = variant === 'link' ? 'primary' : variant;
  const buttonFill = variant === 'link' ? 'text' : fill;

  switch (buttonVariant) {
    case 'secondary':
      return getButtonVariantStyles(theme, theme.colors.secondary, buttonFill);

    case 'destructive':
      return getButtonVariantStyles(theme, theme.colors.error, buttonFill);

    case 'primary':
    default:
      return getButtonVariantStyles(theme, theme.colors.primary, buttonFill);
  }
}

function deprecatedPropWarning(test: boolean, message: string) {
  if (process.env.NODE_ENV === 'development' && test) {
    console.warn(`@grafana/ui ${message}`);
  }
}
