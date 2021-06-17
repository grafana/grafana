import { locationUtil, textUtil } from '@grafana/data';
import React, { AnchorHTMLAttributes, forwardRef } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

export interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  partial?: boolean;
}

function updatePath(loc: ReturnType<typeof useLocation>, newPath: string) {
  const curParams = new URLSearchParams(loc.search);
  const newParams = new URLSearchParams(newPath);
  newParams.forEach((value, key) => {
    curParams.set(key, value);
  });
  return loc.pathname + (curParams ? `?${curParams.toString()}` : '') + (location.hash ? `#${location.hash}` : '');
}

/**
 * @alpha
 */
export const Link = forwardRef<HTMLAnchorElement, Props>(({ href, children, partial, ...rest }, ref) => {
  const location = useLocation();
  let newHref = href && (partial ? updatePath(location, href) : href);
  const validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(newHref ?? ''));

  return (
    <RouterLink ref={ref as React.Ref<HTMLAnchorElement>} to={validUrl} {...rest}>
      {children}
    </RouterLink>
  );
});

Link.displayName = 'Link';
