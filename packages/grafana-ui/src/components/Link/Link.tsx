import { type AnchorHTMLAttributes, forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom-v5-compat';

import { textUtil } from '@grafana/data/text';
import { locationUtil } from '@grafana/data/utils';

export interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {}

export const Link = forwardRef<HTMLAnchorElement, Props>(({ href, children, ...rest }, ref) => {
  const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href ?? ''));

  return (
    <RouterLink ref={ref} to={validUrl} {...rest}>
      {children}
    </RouterLink>
  );
});

Link.displayName = 'Link';
