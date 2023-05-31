import { css } from '@emotion/css';
import React, { AnchorHTMLAttributes, forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { GrafanaTheme2, locationUtil, textUtil, ThemeTypographyVariantTypes } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';

export interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** url to which redirect the user, external or internal */
  href: string;
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  /** If the link will redirect users to a page in or out Grafana */
  externalLink?: boolean;
  /** Specify the icon name to be used */
  icon?: IconName;
  /** To clarify if the link is a block of if it is part of a bigger text */
  inline?: boolean;
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  children: string;
}

/**
 * @alpha
 */
export const TextLink = forwardRef<HTMLAnchorElement, Props>(
  ({ href, color, externalLink = false, inline, variant, weight, icon, children, ...rest }, ref) => {
    const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href ?? ''));

    const theme = useTheme2();
    const styles = getLinkStyles(theme, variant, weight, color, inline);

    return externalLink ? (
      <RouterLink ref={ref} to={validUrl} {...rest} className={styles}>
        {children}
        {icon && !inline && <Icon name={icon} />}
      </RouterLink>
    ) : (
      <a href={validUrl} target="_blank" rel="noreferrer" className={styles}>
        {children}
        {icon && !inline && <Icon name={icon} />}
      </a>
    );
  }
);

export const getLinkStyles = (
  theme: GrafanaTheme2,
  variant?: keyof ThemeTypographyVariantTypes,
  weight?: Props['weight'],
  color?: Props['color'],
  inline = true
) => {
  const linkColor = color ? customColor(color, theme) : theme.colors.text.link;

  return css([
    variant && {
      ...theme.typography[variant],
    },
    weight && {
      fontWeight: customWeight(weight, theme),
    },
    `
      color: ${linkColor};
      display: block;
      &:hover {
        text-decoration: underline;
      };
      & > div > svg {
        vertical-align: text-top;
        display: inline-block;
        margin-left: ${theme.spacing(1)}
      }
      `,
    inline && {
      display: 'inline',
    },
  ]);
};

const customWeight = (weight: Props['weight'], theme: GrafanaTheme2): number => {
  switch (weight) {
    case 'bold':
      return theme.typography.fontWeightBold;
    case 'medium':
      return theme.typography.fontWeightMedium;
    case 'light':
      return theme.typography.fontWeightLight;
    case 'regular':
    case undefined:
      return theme.typography.fontWeightRegular;
  }
};

const customColor = (color: Props['color'], theme: GrafanaTheme2): string | undefined => {
  switch (color) {
    case 'error':
      return theme.colors.error.text;
    case 'success':
      return theme.colors.success.text;
    case 'info':
      return theme.colors.info.text;
    case 'warning':
      return theme.colors.warning.text;
    default:
      return color ? theme.colors.text[color] : undefined;
  }
};

TextLink.displayName = 'TextLink';
