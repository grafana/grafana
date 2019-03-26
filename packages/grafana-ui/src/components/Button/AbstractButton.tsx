import React from 'react';
import tinycolor from 'tinycolor2';
import { css } from 'emotion';
import { Themeable, GrafanaTheme } from '../../types';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

export enum ButtonVariant {
  Primary = 'primary',
  Secondary = 'secondary',
  Danger = 'danger',
  Inverse = 'inverse',
  Transparent = 'transparent',
}

export enum ButtonSize {
  ExtraSmall = 'xs',
  Small = 'sm',
  Medium = 'md',
  Large = 'lg',
  ExtraLarge = 'xl',
}

export interface ButtonProps<T> extends React.HTMLAttributes<T> {
  size: ButtonSize;
  variant: ButtonVariant;
  className?: string;
}

interface AbstractButtonProps extends ButtonProps<any>, Themeable {
  renderAs: React.ComponentType<ButtonProps<any>> | string;
}

const buttonVariantStyles = (
  from: string,
  to: string,
  textColor: string,
  textShadowColor = 'rgba(0, 0, 0, 0.1)',
  invert = false
) => css`
  background: linear-gradient(to bottom, ${from}, ${to});
  color: ${textColor};
  text-shadow: 0 ${invert ? '1px' : '-1px'} ${textShadowColor};
  &:hover {
    background: ${from};
  }

  &:focus {
    background: ${from};
    outline: none;
  }
`;

const getButtonStyles = (theme: GrafanaTheme, size: ButtonSize, variant: ButtonVariant) => {
  const borderRadius = theme.border.radius.sm;
  let padding,
    background,
    fontSize,
    fontWeight = theme.typography.weight.semibold;

  switch (size) {
    case ButtonSize.ExtraSmall:
      padding = `${theme.spacing.xs} ${theme.spacing.sm}`;
      fontSize = theme.typography.size.xs;

      break;
    case ButtonSize.Small:
      padding = `${theme.spacing.xs} ${theme.spacing.sm}`;
      fontSize = theme.typography.size.sm;
      break;
    case ButtonSize.Large:
      padding = `${theme.spacing.md} ${theme.spacing.lg}`;
      fontSize = theme.typography.size.lg;
      fontWeight = theme.typography.weight.regular;
      break;
    case ButtonSize.ExtraLarge:
      padding = `${theme.spacing.md} ${theme.spacing.lg}`;
      fontSize = theme.typography.size.lg;
      fontWeight = theme.typography.weight.regular;
      break;
    default:
      padding = `${theme.spacing.sm} ${theme.spacing.md}`;
      fontSize = theme.typography.size.base;
  }

  switch (variant) {
    case ButtonVariant.Primary:
      background = buttonVariantStyles(theme.colors.greenBase, theme.colors.greenShade, theme.colors.white);
      break;
    case ButtonVariant.Secondary:
      background = buttonVariantStyles(theme.colors.blueBase, theme.colors.blueShade, theme.colors.white);
      break;
    case ButtonVariant.Danger:
      background = buttonVariantStyles(theme.colors.redBase, theme.colors.redShade, theme.colors.white);
      break;
    case ButtonVariant.Inverse:
      const from = selectThemeVariant({ light: theme.colors.gray5, dark: theme.colors.dark6 }, theme.type) as string;
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

      background = buttonVariantStyles(from, to, theme.colors.link, 'rgba(0, 0, 0, 0.1)', true);
      break;
    case ButtonVariant.Transparent:
      background = css`
        ${buttonVariantStyles('', '', theme.colors.link, 'rgba(0, 0, 0, 0.1)', true)};
        background: transparent;
      `;
      break;
  }

  return {
    button: css`
      display: inline-block;
      font-weight: ${fontWeight};
      font-size: ${fontSize};
      font-family: ${theme.typography.fontFamily.sansSerif};
      line-height: ${theme.typography.lineHeight.xs};
      padding: ${padding};
      text-align: center;
      vertical-align: middle;
      cursor: pointer;
      border: none;
      border-radius: ${borderRadius};
      ${background}
    `,
  };
};

export const AbstractButton: React.FunctionComponent<AbstractButtonProps> = ({
  renderAs,
  theme,
  size,
  variant,
  className,
  ...otherProps
}) => {
  const finalClassName = getButtonStyles(theme, size, variant).button;
  const nonHtmlProps = {
    theme,
    size,
    variant,
  };

  if (typeof renderAs === 'string') {
    // Let's not pass props like theme/size/variant to plain HTML elements, i.e. a, button, div
    return React.createElement(renderAs, {
      ...otherProps,
      className: finalClassName,
    });
  }

  return React.createElement(renderAs, {
    ...otherProps,
    ...nonHtmlProps,
    className: finalClassName,
  });
};

AbstractButton.displayName = 'AbstractButton';
