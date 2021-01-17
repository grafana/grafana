import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { styleMixins, stylesFactory, ThemeContext } from '../../themes';
import { IconName } from '../../types/icon';
import { getFocusStyle, getPropertiesForButtonSize } from '../Forms/commonStyles';
import { GrafanaTheme } from '@grafana/data';
import { ButtonContent } from './ButtonContent';
import { ComponentSize } from '../../types/size';
import { focusCss } from '../../themes/mixins';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link' | 'toolbar';

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

export interface StyleProps {
  theme: GrafanaTheme;
  size: ComponentSize;
  variant: ButtonVariant;
}

const disabledStyles = css`
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
`;

export const getButtonStyles = stylesFactory((props: StyleProps) => {
  const { theme, variant } = props;
  const { padding, fontSize, height } = getPropertiesForButtonSize(props);
  const { borderColor, variantStyles } = getPropertiesForVariant(theme, variant);

  return {
    button: css`
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
      ${variantStyles}

      &[disabled],
        &:disabled {
        ${disabledStyles};
      }
    `,
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

function getPropertiesForVariant(theme: GrafanaTheme, variant: ButtonVariant) {
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
            ${focusCss(theme)};
          }
        `,
      };
    case 'toolbar':
      return {
        borderColor: theme.colors.border2,
        variantStyles: css`
          background: ${theme.colors.bg1};
          color: ${theme.colors.textWeak};

          &:hover {
            color: ${theme.colors.text};
            background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
          }

          &:focus {
            outline: none;
            background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
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
