import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { selectThemeVariant, stylesFactory, ThemeContext } from '../../themes';
import { Button as DefaultButton, LinkButton as DefaultLinkButton } from '../Button/Button';
import { getFocusStyle, getPropertiesForButtonSize } from './commonStyles';
import { ComponentSize } from '../../types/size';
import { StyleDeps } from '../Button/types';
import { GrafanaTheme } from '@grafana/data';

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
      const from = selectThemeVariant({ light: theme.colors.gray7, dark: theme.colors.gray15 }, theme.type) as string;
      const to = selectThemeVariant(
        {
          light: tinycolor(from)
            .darken(5)
            .toString(),
          dark: tinycolor(from)
            .lighten(4)
            .toString(),
        },
        theme.type
      ) as string;

      return {
        borderColor: selectThemeVariant({ light: theme.colors.gray85, dark: theme.colors.gray25 }, theme.type),
        background: buttonVariantStyles(
          from,
          to,
          selectThemeVariant({ light: theme.colors.gray25, dark: theme.colors.gray4 }, theme.type) as string
        ),
      };

    case 'destructive':
      return {
        borderColor: theme.colors.redShade,
        background: buttonVariantStyles(theme.colors.redBase, theme.colors.redShade, theme.colors.white),
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
        borderColor: theme.colors.blueShade,
        background: buttonVariantStyles(theme.colors.blueBase, theme.colors.blueShade, theme.colors.white),
      };
  }
};

// Need to do this because of mismatch between variants in standard buttons and here
type StyleProps = Omit<StyleDeps, 'variant'> & { variant: ButtonVariant };

export const getButtonStyles = stylesFactory(({ theme, size, variant }: StyleProps) => {
  const { padding, fontSize, height } = getPropertiesForButtonSize(theme, size);
  const { background, borderColor, variantStyles } = getPropertiesForVariant(theme, variant);

  return {
    button: cx(
      css`
        label: button;
        display: inline-flex;
        align-items: center;
        font-weight: ${theme.typography.weight.semibold};
        font-family: ${theme.typography.fontFamily.sansSerif};
        line-height: ${theme.typography.lineHeight.md};
        font-size: ${fontSize};
        padding: ${padding};
        height: ${height};
        vertical-align: middle;
        cursor: pointer;
        border: 1px solid ${borderColor};
        border-radius: ${theme.border.radius.sm};
        ${background};

        &[disabled],
        &:disabled {
          cursor: not-allowed;
          opacity: 0.65;
          box-shadow: none;
        }
      `,
      getFocusStyle(theme),
      css`
        ${variantStyles}
      `
    ),
    buttonWithIcon: css`
      padding-left: ${theme.spacing.sm};
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

// These are different from the standard Button where there are more variants.
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'link';

// These also needs to be different because the ButtonVariant is different
type CommonProps = {
  size?: ComponentSize;
  variant?: ButtonVariant;
  icon?: string;
  className?: string;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ variant, ...otherProps }, ref) => {
  const theme = useContext(ThemeContext);
  const styles = getButtonStyles({
    theme,
    size: otherProps.size || 'md',
    variant: variant || 'primary',
  });
  return <DefaultButton {...otherProps} variant={variant} styles={styles} ref={ref} />;
});

type ButtonLinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>;
export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(({ variant, ...otherProps }, ref) => {
  const theme = useContext(ThemeContext);
  const styles = getButtonStyles({
    theme,
    size: otherProps.size || 'md',
    variant: variant || 'primary',
  });
  return <DefaultLinkButton {...otherProps} variant={variant} styles={styles} ref={ref} />;
});
