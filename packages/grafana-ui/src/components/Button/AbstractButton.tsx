import React, { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import tinycolor from 'tinycolor2';
import { css, cx } from 'emotion';
import { Themeable, GrafanaTheme } from '../../types';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'inverse' | 'transparent';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CommonButtonProps {
  size?: ButtonSize;
  variant?: ButtonVariant;
  /**
   * icon prop is a temporary solution. It accepts lefacy icon class names for the icon to be rendered.
   * TODO: migrate to a component when we are going to migrate icons to @grafana/ui
   */
  icon?: string;
  className?: string;
}

export interface LinkButtonProps extends CommonButtonProps, AnchorHTMLAttributes<HTMLAnchorElement> {}
export interface ButtonProps extends CommonButtonProps, ButtonHTMLAttributes<HTMLButtonElement> {}

interface AbstractButtonProps extends CommonButtonProps, Themeable {
  renderAs: React.ComponentType<CommonButtonProps> | string;
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
    color: ${textColor};
  }

  &:focus {
    background: ${from};
    outline: none;
  }
`;

const getButtonStyles = (theme: GrafanaTheme, size: ButtonSize, variant: ButtonVariant, withIcon: boolean) => {
  const borderRadius = theme.border.radius.sm;
  let padding,
    background,
    fontSize,
    iconDistance,
    height,
    fontWeight = theme.typography.weight.semibold;

  switch (size) {
    case 'sm':
      padding = `${theme.spacing.xs} ${theme.spacing.sm}`;
      fontSize = theme.typography.size.sm;
      iconDistance = theme.spacing.xs;
      height = theme.height.sm;
      break;
    case 'md':
      padding = `${theme.spacing.sm} ${theme.spacing.md}`;
      fontSize = theme.typography.size.md;
      iconDistance = theme.spacing.sm;
      height = theme.height.md;
      break;
    case 'lg':
      padding = `${theme.spacing.md} ${theme.spacing.lg}`;
      fontSize = theme.typography.size.lg;
      fontWeight = theme.typography.weight.regular;
      iconDistance = theme.spacing.sm;
      height = theme.height.lg;
      break;
    default:
      padding = `${theme.spacing.sm} ${theme.spacing.md}`;
      iconDistance = theme.spacing.sm;
      fontSize = theme.typography.size.base;
      height = theme.height.md;
  }

  switch (variant) {
    case 'primary':
      background = buttonVariantStyles(theme.colors.greenBase, theme.colors.greenShade, theme.colors.white);
      break;
    case 'secondary':
      background = buttonVariantStyles(theme.colors.blueBase, theme.colors.blueShade, theme.colors.white);
      break;
    case 'danger':
      background = buttonVariantStyles(theme.colors.redBase, theme.colors.redShade, theme.colors.white);
      break;
    case 'inverse':
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
    case 'transparent':
      background = css`
        ${buttonVariantStyles('', '', theme.colors.link, 'rgba(0, 0, 0, 0.1)', true)};
        background: transparent;
      `;
      break;
  }

  return {
    button: css`
      label: button;
      display: flex;
      align-items: center;
      font-weight: ${fontWeight};
      font-size: ${fontSize};
      font-family: ${theme.typography.fontFamily.sansSerif};
      line-height: ${theme.typography.lineHeight.xs};
      padding: ${padding};
      text-align: ${withIcon ? 'left' : 'center'};
      vertical-align: middle;
      cursor: pointer;
      border: none;
      height: ${height};
      border-radius: ${borderRadius};
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
};

export const AbstractButton: React.FunctionComponent<AbstractButtonProps> = ({
  renderAs,
  theme,
  size = 'md',
  variant = 'primary',
  className,
  icon,
  children,
  ...otherProps
}) => {
  const buttonStyles = getButtonStyles(theme, size, variant, !!icon);
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

AbstractButton.displayName = 'AbstractButton';
