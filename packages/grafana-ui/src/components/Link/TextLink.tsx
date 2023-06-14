import { css } from '@emotion/css';
import React, { AnchorHTMLAttributes, forwardRef } from 'react';

import { GrafanaTheme2, locationUtil, textUtil, ThemeTypographyVariantTypes } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { customColor, customWeight } from '../Text/utils';

import { Link } from './Link';

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
  children: string;
}

export const TextLink = forwardRef<HTMLAnchorElement, Props>(
  ({ href, color = 'link', external = false, inline, variant, weight, icon, children, ...rest }, ref) => {
    const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href ?? ''));

    const theme = useTheme2();
    const styles = getLinkStyles(theme, variant, weight, color, inline);
    const externalIcon = icon || 'external-link-alt';
    return external ? (
      <a href={validUrl} ref={ref} target="_blank" rel="noreferrer" {...rest} className={styles}>
        {children}
        {!inline && <Icon size={getSvgVariantSize(variant)} name={externalIcon} />}
      </a>
    ) : (
      <Link ref={ref} href={validUrl} {...rest} className={styles}>
        {children}
        {icon && !inline && <Icon name={icon} />}
      </Link>
    );
  }
);

TextLink.displayName = 'TextLink';

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
        margin-left: ${theme.spacing(1)};
        margin-bottom: ${adjustIconSize(variant, theme)};
      }
      `,
    inline && {
      display: 'inline',
    },
  ]);
};

export function getSvgVariantSize(variant: keyof ThemeTypographyVariantTypes = 'body') {
  if (variant === 'h1' || variant === 'h2') {
    return 'xl';
  } else if (variant === 'h3' || variant === 'h4') {
    return 'lg';
  } else if (variant === 'bodySmall') {
    return 'xs';
  } else {
    return 'md';
  }
}

export function adjustIconSize(variant: keyof ThemeTypographyVariantTypes = 'body', theme: GrafanaTheme2) {
  if (variant !== 'h1' && variant !== 'h3' && variant !== 'bodySmall') {
    return theme.spacing(0.25);
  } else if (variant === 'bodySmall') {
    return theme.spacing(0.17);
  } else {
    return 'inherit';
  }
}
