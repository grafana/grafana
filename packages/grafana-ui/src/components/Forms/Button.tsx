import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { selectThemeVariant, stylesFactory, ThemeContext } from '../../themes';
import { Button as DefaultButton, LinkButton as DefaultLinkButton } from '../Button/Button';
import { getFocusStyle } from './commonStyles';
import { ButtonSize, StyleDeps } from '../Button/types';
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

const getPropertiesForSize = (theme: GrafanaTheme, size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return {
        padding: `0 ${theme.spacing.sm}`,
        fontSize: theme.typography.size.sm,
        height: theme.height.sm,
      };

    case 'md':
      return {
        padding: `0 ${theme.spacing.md}`,
        fontSize: theme.typography.size.md,
        height: `${theme.spacing.formButtonHeight}px`,
      };

    case 'lg':
      return {
        padding: `0 ${theme.spacing.lg}`,
        fontSize: theme.typography.size.lg,
        height: theme.height.lg,
      };

    default:
      return {
        padding: `0 ${theme.spacing.md}`,
        fontSize: theme.typography.size.base,
        height: theme.height.md,
      };
  }
};

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
        borderColor: selectThemeVariant({ light: theme.colors.gray70, dark: theme.colors.gray33 }, theme.type),
        background: buttonVariantStyles(from, to, selectThemeVariant(
          { light: theme.colors.gray25, dark: theme.colors.gray4 },
          theme.type
        ) as string),
      };

    case 'destructive':
      return {
        borderColor: theme.colors.redShade,
        background: buttonVariantStyles(theme.colors.redBase, theme.colors.redShade, theme.colors.white),
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
  const { padding, fontSize, height } = getPropertiesForSize(theme, size);
  const { background, borderColor } = getPropertiesForVariant(theme, variant);

  return {
    button: cx(
      css`
        position: relative;
        label: button;
        display: inline-flex;
        align-items: center;
        font-weight: ${theme.typography.weight.semibold};
        font-size: ${fontSize};
        font-family: ${theme.typography.fontFamily.sansSerif};
        line-height: ${theme.typography.lineHeight.sm};
        padding: ${padding};
        vertical-align: middle;
        cursor: pointer;
        border: 1px solid ${borderColor};
        height: ${height};
        border-radius: ${theme.border.radius.sm};
        ${background};

        &[disabled],
        &:disabled {
          cursor: not-allowed;
          opacity: 0.65;
          box-shadow: none;
        }
      `,
      getFocusStyle(theme)
    ),
    iconWrap: css`
      label: button-icon-wrap;
      display: flex;
      align-items: center;
    `,
  };
});

// These are different from the standard Button where there are 5 variants.
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

// These also needs to be different because the ButtonVariant is different
type CommonProps = {
  size?: ButtonSize;
  variant?: ButtonVariant;
  icon?: string;
  className?: string;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = (props: ButtonProps) => {
  const theme = useContext(ThemeContext);
  const styles = getButtonStyles({
    theme,
    size: props.size || 'md',
    variant: props.variant || 'primary',
  });
  return <DefaultButton {...props} styles={styles} />;
};

type ButtonLinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>;
export const LinkButton = (props: ButtonLinkProps) => {
  const theme = useContext(ThemeContext);
  const styles = getButtonStyles({
    theme,
    size: props.size || 'md',
    variant: props.variant || 'primary',
  });
  return <DefaultLinkButton {...props} styles={styles} />;
};
