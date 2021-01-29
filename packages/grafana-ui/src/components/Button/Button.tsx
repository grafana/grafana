import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { useTheme } from '../../themes';
import { IconName } from '../../types/icon';
import { getPropertiesForButtonSize } from '../Forms/commonStyles';
import { GrafanaTheme } from '@grafana/data';
import { ComponentSize } from '../../types/size';
import { focusCss } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';

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
      icon,
      fullWidth,
      children,
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
      icon,
      children,
    });

    const linkButtonStyles =
      disabled &&
      cx(
        disabledStyles,
        css`
          pointer-events: none;
        `
      );

    return (
      <a
        className={cx(styles.button, linkButtonStyles, className)}
        {...otherProps}
        ref={ref}
        tabIndex={disabled ? -1 : 0}
      >
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
  children?: React.ReactNode;
  icon?: IconName;
  theme: GrafanaTheme;
  fullWidth?: boolean;
  narrow?: boolean;
}

const disabledStyles = css`
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
`;

export const getButtonStyles = (props: StyleProps) => {
  const { theme, variant, size, children, fullWidth } = props;
  const { padding, fontSize, height } = getPropertiesForButtonSize(size, theme);
  const { borderColor, variantStyles } = getPropertiesForVariant(theme, variant);
  const iconOnly = !children;

  return {
    button: css`
      label: button;
      display: inline-flex;
      align-items: center;
      font-weight: ${theme.typography.weight.semibold};
      font-family: ${theme.typography.fontFamily.sansSerif};
      font-size: ${fontSize};
      padding: 0 ${padding}px;
      height: ${height}px;
      // Deduct border from line-height for perfect vertical centering on windows and linux
      line-height: ${height - 2}px;
      vertical-align: middle;
      cursor: pointer;
      border: 1px solid ${borderColor};
      border-radius: ${theme.border.radius.sm};
      ${fullWidth &&
      `
        flex-grow: 1;
        justify-content: center;
      `}
      ${variantStyles}      

      &[disabled],
        &:disabled {
        ${disabledStyles};
      }
    `,
    img: css`
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing.sm};
      margin-left: -${theme.spacing.xs};
    `,
    icon: css`
      margin-left: -${padding / 2}px;
      margin-right: ${(iconOnly ? -padding : padding) / 2}px;
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

function getButtonVariantStyles(from: string, to: string, textColor: string, theme: GrafanaTheme) {
  return css`
    background: linear-gradient(180deg, ${from} 0%, ${to} 100%);
    color: ${textColor};
    &:hover {
      background: ${from};
      color: ${textColor};
    }

    &:focus {
      background: ${from};
      outline: none;
      ${focusCss(theme)};
    }
  `;
}

export function getPropertiesForVariant(theme: GrafanaTheme, variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      const from = theme.isLight ? theme.palette.gray7 : theme.palette.gray15;
      const to = theme.isLight ? tinycolor(from).darken(5).toString() : tinycolor(from).lighten(4).toString();
      return {
        borderColor: theme.isLight ? theme.palette.gray85 : theme.palette.gray25,
        variantStyles: getButtonVariantStyles(
          from,
          to,
          theme.isLight ? theme.palette.gray25 : theme.palette.gray4,
          theme
        ),
      };

    case 'destructive':
      return {
        borderColor: theme.palette.redShade,
        variantStyles: getButtonVariantStyles(
          theme.palette.redBase,
          theme.palette.redShade,
          theme.palette.white,
          theme
        ),
      };

    case 'link':
      return {
        borderColor: 'transparent',
        variantStyles: css`
          background: transparent;
          color: ${theme.colors.linkExternal};

          &:focus {
            outline: none;
            text-decoration: underline;
          }
        `,
      };

    case 'primary':
    default:
      return {
        borderColor: theme.colors.bgBlue1,
        variantStyles: getButtonVariantStyles(theme.colors.bgBlue1, theme.colors.bgBlue2, theme.palette.white, theme),
      };
  }
}
