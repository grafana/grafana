import { css } from '@emotion/css';
import React, { AnchorHTMLAttributes, forwardRef } from 'react';

import { GrafanaTheme2, locationUtil, textUtil, ThemeTypographyVariantTypes } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { customColor, customWeight } from '../Text/utils';

import { Link } from './Link';

interface TextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** url to which redirect the user, external or internal */
  href: string;
  /** Color to use for text */
  color?: keyof GrafanaTheme2['colors']['text'] | 'error' | 'success' | 'warning' | 'info';
  /** Specify if the link will redirect users to a page in or out Grafana */
  external?: boolean;
  /** True if the element should be displayed inline with surrounding text, false if it should be displayed as a block */
  inline?: boolean;
  /** What typograpy variant should be used for the component. Only use if default variant for the defined element is not what is needed */
  variant?: keyof ThemeTypographyVariantTypes;
  /** Override the default weight for the used variant */
  weight?: 'light' | 'regular' | 'medium' | 'bold';
  /** When it is a standalone element, whether to align the text to left, center or right of its block*/
  textAlignment?: 'left' | 'right' | 'center';
  /** When the link is inline it won't show an icon.
   * If it is a standalone element, it will show the icon specified. When this is an external link, the default icon will be 'external-link-alt' */
  icon?: IconName;
  children: string;
}

export const TextLink = forwardRef<HTMLAnchorElement, TextLinkProps>(
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
  weight?: TextLinkProps['weight'],
  color?: TextLinkProps['color'],
  inline = true,
  textAlignment: TextLinkProps['textAlignment'] = 'left'
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
      gap: theme.spacing(1),
      color: linkColor,
      display: 'flex',
      justifyContent: getFlexAlignment(textAlignment),
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    inline && {
      display: 'inline-flex',
    },
  ]);
};

const getSvgVariantSize = (variant: keyof ThemeTypographyVariantTypes = 'body') => {
  if (variant === 'h1' || variant === 'h2') {
    return 'xl';
  } else if (variant === 'h3' || variant === 'h4') {
    return 'lg';
  } else if (variant === 'bodySmall') {
    return 'xs';
  } else {
    return 'md';
  }
};

const getFlexAlignment = (textAlignment: TextLinkProps['textAlignment']) => {
  if (textAlignment === 'right') {
    return 'flex-end';
  } else if (textAlignment === 'center') {
    return 'center';
  } else {
    return 'flex-start';
  }
};
