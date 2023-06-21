import { css } from '@emotion/css';
import React, { AnchorHTMLAttributes, forwardRef } from 'react';

import { GrafanaTheme2, locationUtil, textUtil, ThemeTypographyVariantTypes } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { IconName, IconSize } from '../../types';
import { Icon } from '../Icon/Icon';
import { customColor, customWeight } from '../Text/utils';

import { Link } from './Link';

interface TextLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'> {
  /** url to which redirect the user, external or internal */
  href: string;
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'];
  /** Specify if the link will redirect users to a page in or out Grafana */
  external?: boolean;
  /** True if the element should be displayed inline with surrounding text, false if it should be displayed as a block */
  inline?: boolean;
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  /** Set the icon to be shown. An external link will show the 'external-link-alt' icon as default.*/
  icon?: IconName;
  children: string;
}

export const TextLink = forwardRef<HTMLAnchorElement, TextLinkProps>(
  ({ href, color = 'link', external = false, inline, variant = 'body', weight, icon, children, ...rest }, ref) => {
    const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href ?? ''));

    const theme = useTheme2();
    const styles = getLinkStyles(theme, variant, weight, color, inline);
    const externalIcon = icon || 'external-link-alt';
    const svgSizes: {
      [key in keyof ThemeTypographyVariantTypes]: IconSize;
    } = {
      h1: 'xl',
      h2: 'xl',
      h3: 'lg',
      h4: 'lg',
      h5: 'md',
      h6: 'md',
      body: 'md',
      bodySmall: 'xs',
    };

    return external ? (
      <a href={validUrl} ref={ref} target="_blank" rel="noreferrer" {...rest} className={styles}>
        {children}
        <Icon size={svgSizes[variant] || 'md'} name={externalIcon} />
      </a>
    ) : (
      <Link ref={ref} href={validUrl} {...rest} className={styles}>
        {children}
        {icon && <Icon name={icon} />}
      </Link>
    );
  }
);

TextLink.displayName = 'TextLink';

export const getLinkStyles = (
  theme: GrafanaTheme2,
  variant?: keyof ThemeTypographyVariantTypes,
  weight?: TextLinkProps['weight'],
  color?: TextLinkProps['color'],
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
    {
      alignItems: 'center',
      gap: '0.25em',
      color: linkColor,
      display: 'flex',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    inline && {
      display: 'inline-flex',
    },
  ]);
};
