import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { css, CSSObject, cx } from '@emotion/css';
import { useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { colorManipulator, GrafanaThemeV2, ThemeRichColor } from '@grafana/data';
import { ComponentSize } from '../../types/size';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';
export const allButtonVariants: ButtonVariant[] = ['primary', 'secondary', 'destructive'];
export type ButtonStyle = 'solid' | 'outline' | 'text';
export const allButtonStyles: ButtonStyle[] = ['solid', 'outline', 'text'];

type CommonProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  buttonStyle?: ButtonStyle;
  icon?: IconName;
  className?: string;
  children?: React.ReactNode;
  fullWidth?: boolean;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', buttonStyle = 'solid', icon, fullWidth, children, className, ...otherProps },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      size,
      variant,
      buttonStyle,
      fullWidth,
      iconOnly: !children,
    });

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
      buttonStyle = 'solid',
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
      buttonStyle,
      iconOnly: !children,
    });

    const linkButtonStyles = cx(styles.button, { [styles.disabled]: disabled }, className);

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
  buttonStyle?: ButtonStyle;
  iconOnly?: boolean;
  theme: GrafanaThemeV2;
  fullWidth?: boolean;
  narrow?: boolean;
}

export const getButtonStyles = (props: StyleProps) => {
  const { theme, variant, buttonStyle = 'solid', size, iconOnly, fullWidth } = props;
  const { height, padding, fontSize } = getPropertiesForButtonSize(size, theme);
  const variantStyles = getPropertiesForVariant(theme, variant, buttonStyle);
  const disabledStyles = getPropertiesForDisabled(theme, variant, buttonStyle);

  const focusStyle = getFocusStyles(theme);

  return {
    button: css({
      label: 'button',
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      fontFamily: theme.typography.fontFamily,
      padding: theme.spacing(0, padding),
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
    icon: css`
      margin: ${theme.spacing(0, (iconOnly ? -padding : padding) / 2, 0, -(padding / 2))};
    `,
    content: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      white-space: nowrap;
      height: 100%;
    `,
  };
};

function getButtonVariantStyles(theme: GrafanaThemeV2, color: ThemeRichColor, style: ButtonStyle): CSSObject {
  if (style === 'outline') {
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

  if (style === 'text') {
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

function getPropertiesForDisabled(theme: GrafanaThemeV2, variant: ButtonVariant, style: ButtonStyle) {
  const disabledStyles: CSSObject = {
    cursor: 'not-allowed',
    boxShadow: 'none',
    pointerEvents: 'none',
    color: theme.colors.text.disabled,
    transition: 'none',
  };

  if (style === 'text' || variant === 'link') {
    return {
      ...disabledStyles,
      background: 'transparent',
      border: `1px solid transparent`,
    };
  }

  if (style === 'outline') {
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

export function getPropertiesForVariant(theme: GrafanaThemeV2, variant: ButtonVariant, style: ButtonStyle) {
  const buttonVariant = variant === 'link' ? 'primary' : variant;
  const buttonStyle = variant === 'link' ? 'text' : style;

  switch (buttonVariant) {
    case 'secondary':
      return getButtonVariantStyles(theme, theme.colors.secondary, buttonStyle);

    case 'destructive':
      return getButtonVariantStyles(theme, theme.colors.error, buttonStyle);

    case 'primary':
    default:
      return getButtonVariantStyles(theme, theme.colors.primary, buttonStyle);
  }
}
