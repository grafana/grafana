import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { css, CSSObject, cx } from '@emotion/css';
import { useStyles, useTheme } from '../../themes';
import { IconName } from '../../types/icon';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { GrafanaTheme, GrafanaThemeV2, ThemePaletteColor } from '@grafana/data';
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
  ({ variant = 'primary', size = 'md', icon, fullWidth, children, className, disabled, ...otherProps }, ref) => {
    const styles = useStyles(getStyles);

    const rootClass = cx(
      styles.button,
      styles[variant],
      {
        [styles.disabled]: disabled,
        [styles.fullWidth]: fullWidth,
      },
      className
    );

    const iconClass = children ? styles.icon : styles.iconOnly;

    return (
      <button className={rootClass} disabled={disabled} {...otherProps} ref={ref}>
        {icon && <Icon name={icon} size={size} className={iconClass} />}
        {children && <span className={styles.content}>{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

type ButtonLinkProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>;

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = 'primary', size = 'md', icon, fullWidth, children, className, disabled, ...otherProps }, ref) => {
    const styles = useStyles(getStyles);

    const rootClass = cx(
      styles.button,
      styles[variant],
      {
        [styles.disabled]: disabled,
        [styles.fullWidth]: fullWidth,
      },
      className
    );

    const iconClass = children ? styles.icon : styles.iconOnly;

    return (
      <a className={rootClass} {...otherProps} ref={ref} tabIndex={disabled ? -1 : 0}>
        {icon && <Icon name={icon} size={size} className={'grafana-ui-button-icon'} />}
        {children && <span className={styles.content}>{children}</span>}
      </a>
    );
  }
);

LinkButton.displayName = 'LinkButton';

export interface StyleProps {
  size: ComponentSize;
  variant: ButtonVariant;
  children?: React.ReactNode;
  icon?: IconName;
  theme: GrafanaTheme;
  fullWidth?: boolean;
  narrow?: boolean;
}

export const getStyles = (theme: GrafanaTheme) => {
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
    }),
    primary: css(getPropertiesForVariant(theme.v2, 'primary')),
    secondary: css(getPropertiesForVariant(theme.v2, 'secondary')),
    destructive: css(getPropertiesForVariant(theme.v2, 'destructive')),
    link: css(getPropertiesForVariant(theme.v2, 'destructive')),
    disabled: css({
      cursor: 'not-allowed',
      opacity: 0.65,
      boxShadow: 'none',
      background: theme.v2.palette.formComponent.disabledBackground,
      border: `1px solid ${theme.v2.palette.formComponent.disabledBackground}`,
      color: theme.v2.palette.text.disabled,
      pointerEvents: 'none',

      '&:hover': {
        background: theme.v2.palette.formComponent.disabledBackground,
        color: theme.v2.palette.text.disabled,
      },
    }),
    sizeMD: css(getPropertiesForButtonSize('md', theme.v2)),
    sizeSM: css(getPropertiesForButtonSize('sm', theme.v2)),
    sizeLG: css(getPropertiesForButtonSize('lg', theme.v2)),
    fullWidth: css({
      flexGrow: 1,
      justifyContent: 'center',
    }),
    img: css`
      width: 16px;
      height: 16px;
      margin: ${theme.v2.spacing(0, 1, 0, 0.5)};
    `,
    icon: css`
      margin: ${theme.v2.spacing(0, padding / 2, 0, -(padding / 2))};
    `,
    iconOnly: css({
      margin: theme.v2.spacing(0, -padding / 2, 0, -padding / 2),
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

function getButtonVariantStyles(theme: GrafanaThemeV2, color: ThemePaletteColor): CSSObject {
  return {
    label: `button-${color.name}`,
    background: color.main,
    color: color.contrastText,
    boxShadow: theme.shadows.z1,
    border: `1px solid transparent`,

    '&:hover': {
      background: theme.palette.getHoverColor(color.main),
      color: color.contrastText,
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
          color: theme.palette.getHoverColor(theme.palette.text.link),
          textDecoration: 'underline',
        },
      };

    case 'primary':
    default:
      return getButtonVariantStyles(theme, theme.palette.primary);
  }
}
