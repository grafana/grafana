import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { stylesFactory, ThemeContext } from '../../themes';
import { IconName } from '../../types/icon';
import { getFocusStyle, getPropertiesForButtonSize } from '../Forms/commonStyles';
import { GrafanaTheme } from '@grafana/data';
import { ButtonContent } from './ButtonContent';
import { ComponentSize } from '../../types/size';

const buttonVariantStyles = (from: string, to: string, textColor: string) => css`
  background: linear-gradient(180deg, ${from} 0%, ${to} 100%);
  color: ${textColor};
  &:hover {
    background: ${from};
    color: ${textColor};
  }

  &:focus {
    background: ${from};
    outline: none;
  }
`;

const getPropertiesForVariant = (theme: GrafanaTheme, variant: ButtonVariant) => {
  switch (variant) {
    case 'secondary':
      const from = theme.isLight ? theme.palette.gray7 : theme.palette.gray15;
      const to = theme.isLight
        ? tinycolor(from)
            .darken(5)
            .toString()
        : tinycolor(from)
            .lighten(4)
            .toString();
      return {
        borderColor: theme.isLight ? theme.palette.gray85 : theme.palette.gray25,
        background: buttonVariantStyles(from, to, theme.isLight ? theme.palette.gray25 : theme.palette.gray4),
      };

    case 'destructive':
      return {
        borderColor: theme.palette.redShade,
        background: buttonVariantStyles(theme.palette.redBase, theme.palette.redShade, theme.palette.white),
      };

    case 'link':
      return {
        borderColor: 'transparent',
        background: buttonVariantStyles('transparent', 'transparent', theme.colors.linkExternal),
        variantStyles: css`
          &:focus {
            outline: none;
            box-shadow: none;
          }
        `,
      };
    case 'primary':
    default:
      return {
        borderColor: theme.colors.bgBlue1,
        background: buttonVariantStyles(theme.colors.bgBlue1, theme.colors.bgBlue2, theme.palette.white),
      };
  }
};

export interface StyleProps {
  theme: GrafanaTheme;
  size: ComponentSize;
  variant: ButtonVariant;
  hasIcon: boolean;
  hasText: boolean;
}

const disabledStyles = css`
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
`;

export const getButtonStyles = stylesFactory((props: StyleProps) => {
  const { theme, variant } = props;
  const { padding, fontSize, height } = getPropertiesForButtonSize(props);
  const { background, borderColor, variantStyles } = getPropertiesForVariant(theme, variant);

  return {
    button: cx(
      css`
        label: button;
        display: inline-flex;
        align-items: center;
        font-weight: ${theme.typography.weight.semibold};
        font-family: ${theme.typography.fontFamily.sansSerif};
        font-size: ${fontSize};
        padding: ${padding};
        height: ${height}px;
        // Deduct border from line-height for perfect vertical centering on windows and linux
        line-height: ${height - 2}px;
        vertical-align: middle;
        cursor: pointer;
        border: 1px solid ${borderColor};
        border-radius: ${theme.border.radius.sm};
        ${background};

        &[disabled],
        &:disabled {
          ${disabledStyles};
        }
      `,
      getFocusStyle(theme),
      css`
        ${variantStyles}
      `
    ),
    // used for buttons with icon only
    iconButton: css`
      padding-right: 0;
    `,
    iconWrap: css`
      label: button-icon-wrap;
      & + * {
        margin-left: ${theme.spacing.sm};
      }
    `,
  };
});

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';

type CommonProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  icon?: IconName;
  className?: string;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, icon, children, className, ...otherProps }, ref) => {
    const theme = useContext(ThemeContext);
    const styles = getButtonStyles({
      theme,
      size: otherProps.size || 'md',
      variant: variant || 'primary',
      hasText: children !== undefined,
      hasIcon: icon !== undefined,
    });

    return (
      <button className={cx(styles.button, className)} {...otherProps} ref={ref}>
        <ButtonContent icon={icon} size={otherProps.size}>
          {children}
        </ButtonContent>
      </button>
    );
  }
);

Button.displayName = 'Button';

type ButtonLinkProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>;
export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant, icon, children, className, disabled, ...otherProps }, ref) => {
    const theme = useContext(ThemeContext);
    const styles = getButtonStyles({
      theme,
      size: otherProps.size || 'md',
      variant: variant || 'primary',
      hasText: children !== undefined,
      hasIcon: icon !== undefined,
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
        <ButtonContent icon={icon} size={otherProps.size}>
          {children}
        </ButtonContent>
      </a>
    );
  }
);
LinkButton.displayName = 'LinkButton';
