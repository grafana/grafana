import { FC } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { selectThemeVariant, stylesFactory, useTheme } from '../../themes';
import { renderButton } from '../Button/AbstractButton';
import { getFocusStyle } from './commonStyles';
import { AbstractButtonProps, ButtonSize, ButtonVariant, StyleDeps } from '../Button/types';
import { GrafanaTheme } from '../../types';

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
        iconDistance: theme.spacing.xs,
        height: theme.height.sm,
      };

    case 'md':
      return {
        padding: `0 ${theme.spacing.md}`,
        fontSize: theme.typography.size.md,
        iconDistance: theme.spacing.sm,
        height: `${theme.spacing.formButtonHeight}px`,
      };

    case 'lg':
      return {
        padding: `0 ${theme.spacing.lg}`,
        fontSize: theme.typography.size.lg,
        iconDistance: theme.spacing.sm,
        height: theme.height.lg,
      };

    default:
      return {
        padding: `0 ${theme.spacing.md}`,
        iconDistance: theme.spacing.sm,
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

export const getButtonStyles = stylesFactory(({ theme, size, variant, withIcon }: StyleDeps) => {
  const { padding, fontSize, iconDistance, height } = getPropertiesForSize(theme, size);
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
        text-align: ${withIcon ? 'left' : 'center'};
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
    icon: css`
      label: button-icon;
      margin-right: ${iconDistance};
      filter: brightness(100);
    `,
  };
});

export const Button: FC<Omit<AbstractButtonProps, 'theme'>> = ({
  renderAs,
  size = 'md',
  variant = 'primary',
  className,
  icon,
  children,
  ...otherProps
}) => {
  const theme = useTheme();
  const buttonStyles = getButtonStyles({ theme, size, variant, withIcon: !!icon });

  return renderButton(theme, buttonStyles, renderAs, children, size, variant, icon, className, otherProps);
};
