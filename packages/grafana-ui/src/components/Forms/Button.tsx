import React, { FC } from 'react';
import { css, cx } from 'emotion';
import tinycolor from 'tinycolor2';
import { selectThemeVariant, stylesFactory } from '../../themes';
import { AbstractButtonProps, StyleDeps } from '../Button/types';

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

export const getButtonStyles = stylesFactory(({ theme, size, variant, withIcon }: StyleDeps) => {
  let padding, background, fontSize, iconDistance, height, borderColor;

  switch (size) {
    case 'sm':
      padding = `0 ${theme.spacing.sm}`;
      fontSize = theme.typography.size.sm;
      iconDistance = theme.spacing.xs;
      height = theme.height.sm;
      break;

    case 'md':
      padding = `0 ${theme.spacing.md}`;
      fontSize = theme.typography.size.md;
      iconDistance = theme.spacing.sm;
      height = `${theme.spacing.formButtonHeight}px`;
      break;

    case 'lg':
      padding = `0 ${theme.spacing.lg}`;
      fontSize = theme.typography.size.lg;
      iconDistance = theme.spacing.sm;
      height = theme.height.lg;
      break;

    default:
      padding = `0 ${theme.spacing.md}`;
      iconDistance = theme.spacing.sm;
      fontSize = theme.typography.size.base;
      height = theme.height.md;
  }

  switch (variant) {
    case 'primary':
      borderColor = theme.colors.blueShade;
      background = buttonVariantStyles(theme.colors.blueBase, theme.colors.blueShade, theme.colors.white);
      break;

    case 'secondary':
      borderColor = selectThemeVariant({ light: theme.colors.gray70, dark: theme.colors.gray33 }, theme.type);
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
      background = buttonVariantStyles(from, to, selectThemeVariant(
        { light: theme.colors.gray25, dark: theme.colors.gray4 },
        theme.type
      ) as string);

      break;

    case 'destructive':
      borderColor = theme.colors.redShade;
      background = buttonVariantStyles(theme.colors.redBase, theme.colors.redShade, theme.colors.white);
      break;
  }

  return {
    button: css`
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

export const Button: FC<AbstractButtonProps> = ({
  renderAs,
  theme,
  size = 'md',
  variant = 'primary',
  className,
  icon,
  children,
  ...otherProps
}) => {
  const buttonStyles = getButtonStyles({ theme, size, variant, withIcon: !!icon });
  const nonHtmlProps = {
    theme,
    size,
    variant,
  };

  const finalClassName = cx(buttonStyles.button, className);
  const finalChildren = icon ? (
    <span className={buttonStyles.iconWrap}>
      <i className={cx([icon, buttonStyles.icon])} />
      <span>{children}</span>
    </span>
  ) : (
    children
  );

  const finalProps =
    typeof renderAs === 'string'
      ? {
          ...otherProps,
          className: finalClassName,
          children: finalChildren,
        }
      : {
          ...otherProps,
          ...nonHtmlProps,
          className: finalClassName,
          children: finalChildren,
        };

  return React.createElement(renderAs, finalProps);
};
