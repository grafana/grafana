import React, { AnchorHTMLAttributes, forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { locationUtil, textUtil } from '@grafana/data';

export interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {}

/**
 * @alpha
 */
export const Link = forwardRef<HTMLAnchorElement, Props>(({ href, children, ...rest }, ref) => {
  const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href ?? ''));

  return (
    <RouterLink ref={ref} to={validUrl} {...rest}>
      {children}
    </RouterLink>
  );
});

Link.displayName = 'Link';
