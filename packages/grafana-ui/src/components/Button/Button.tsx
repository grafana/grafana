import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { css, CSSObject, cx } from '@emotion/css';
import { useTheme } from '../../themes';
import { IconName } from '../../types/icon';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { colorManipulator, GrafanaTheme, GrafanaThemeV2, ThemePaletteColor } from '@grafana/data';
import { ComponentSize } from '../../types/size';
import { getFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';
export const allButtonVariants: ButtonVariant[] = ['primary', 'secondary', 'destructive', 'link'];

type CommonProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  icon?: IconName;
  className?: string;
  children?: React.ReactNode;
  fullWidth?: boolean;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, fullWidth, children, className, ...otherProps }, ref) => {
    const theme = useTheme();
    const styles = getButtonStyles({
      theme,
      size,
      variant,
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
  ({ variant = 'primary', size = 'md', icon, fullWidth, children, className, disabled, ...otherProps }, ref) => {
    const theme = useTheme();
    const styles = getButtonStyles({
      theme,
      fullWidth,
      size,
      variant,
      iconOnly: !children,
    });

    const linkButtonStyles = cx(styles.button, { [styles.disabled]: disabled }, className);

    return (
      <a className={linkButtonStyles} {...otherProps} ref={ref} tabIndex={disabled ? -1 : 0}>
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
  iconOnly?: boolean;
  theme: GrafanaTheme;
  fullWidth?: boolean;
  narrow?: boolean;
}

export const getButtonStyles = (props: StyleProps) => {
  const { theme, variant, size, iconOnly, fullWidth } = props;
  const { height, padding, fontSize } = getPropertiesForButtonSize(size, theme.v2);
  const variantStyles = getPropertiesForVariant(theme.v2, variant);

  const disabledStyles: CSSObject = {
    cursor: 'not-allowed',
    boxShadow: 'none',
    background: theme.v2.palette.action.disabledBackground,
    border: `1px solid transparent`,
    color: theme.v2.palette.text.disabled,
    pointerEvents: 'none',

    '&:hover': {
      background: theme.v2.palette.action.disabledBackground,
      color: theme.v2.palette.text.disabled,
      boxShadow: 'none',
    },
  };

  return {
    button: css({
      label: 'button',
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: fontSize,
      fontWeight: theme.v2.typography.fontWeightMedium,
      fontFamily: theme.v2.typography.fontFamily,
      padding: theme.v2.spacing(0, padding),
      height: theme.v2.spacing(height),
      // Deduct border from line-height for perfect vertical centering on windows and linux
      lineHeight: `${theme.v2.spacing.gridSize * height - 2}px`,
      verticalAlign: 'middle',
      cursor: 'pointer',
      borderRadius: theme.v2.shape.borderRadius(1),
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
      margin: ${theme.v2.spacing(0, 1, 0, 0.5)};
    `,
    icon: css`
      margin: ${theme.v2.spacing(0, (iconOnly ? -padding : padding) / 2, 0, -(padding / 2))};
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

function getButtonVariantStyles(theme: GrafanaThemeV2, color: ThemePaletteColor): CSSObject {
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
      boxShadow: theme.shadows.z2,
    },

    '&:focus': {
      ...getFocusStyles(theme),
    },
  };
}

export function getPropertiesForVariant(theme: GrafanaThemeV2, variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return getButtonVariantStyles(theme, theme.palette.secondary);

    case 'destructive':
      return getButtonVariantStyles(theme, theme.palette.error);

    case 'link':
      return {
        background: 'transparent',
        color: theme.palette.text.link,
        border: '1px solid transparent',
        '&:focus': {
          outline: 'none',
          textDecoration: 'underline',
        },

        '&:hover': {
          background: colorManipulator.alpha(theme.palette.text.link, theme.palette.action.hoverOpacity),
          textDecoration: 'underline',
        },
      };

    case 'primary':
    default:
      return getButtonVariantStyles(theme, theme.palette.primary);
  }
}
