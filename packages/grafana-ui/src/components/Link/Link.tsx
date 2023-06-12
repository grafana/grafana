import { css } from '@emotion/css';
import React, { AnchorHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { GrafanaTheme2, locationUtil, textUtil, ThemeTypographyVariantTypes } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { customColor, customWeight } from '../Text/utils';
export interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** url to which redirect the user, external or internal */
  href: string;
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  /** If the link will redirect users to a page in or out Grafana */
  external?: boolean;
  /** Specify the icon name to be used when the link is not an inline element. If this is undefined but the link is external and not inline, the link icon will be shown. */
  icon?: IconName;
  /** True if the element should be displayed inline with surrounding text, false if it should be displayed as a block */
  inline?: boolean;
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  children: string | ReactNode;
}

/**
 * @alpha
 */
export const Link = forwardRef<HTMLAnchorElement, Props>(
  ({ href, color = 'link', external = false, inline, variant, weight, icon, children, ...rest }, ref) => {
    const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href ?? ''));

    const theme = useTheme2();
    const styles = getLinkStyles(theme, variant, weight, color, inline);

    return external ? (
      <a href={validUrl} target="_blank" rel="noreferrer" {...rest} className={styles}>
        {children}
        {icon && !inline && <Icon name={icon} />}
      </a>
    ) : (
      <RouterLink ref={ref} to={validUrl} {...rest} className={styles}>
        {children}
        {icon && !inline && <Icon name={icon} />}
      </RouterLink>
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

Link.displayName = 'Link';
