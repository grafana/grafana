import { type NavModelItem } from '@grafana/data';

/**
 * Walks the nav tree and returns the deepest nav item whose URL best matches the given pathname.
 * Exact matches win over ancestor-prefix matches; among ancestor matches, the longest URL wins.
 * The pathname should already be stripped of appSubUrl (as react-router's useLocation does); nav
 * item URLs are expected to still carry the prefix and may include a query or hash.
 */
export const findNavItemForPath = (
  navTree: NavModelItem[],
  pathname: string,
  appSubUrl = ''
): NavModelItem | undefined => {
  const normalizedPath = withoutTrailingSlash(pathname);
  const subUrlPrefix = withoutTrailingSlash(appSubUrl).replace(/^\/$/, '');
  let longestMatch: { url: string; item: NavModelItem } | undefined;

  const visit = (items: NavModelItem[]) => {
    for (const item of items) {
      if (item.url && item.text) {
        const itemUrl = toComparablePath(item.url, subUrlPrefix);
        const isExactMatch = itemUrl === normalizedPath;
        const isAncestorMatch = itemUrl !== '/' && normalizedPath.startsWith(itemUrl + '/');
        if ((isExactMatch || isAncestorMatch) && (!longestMatch || itemUrl.length > longestMatch.url.length)) {
          longestMatch = { url: itemUrl, item };
        }
      }
      if (item.children) {
        visit(item.children);
      }
    }
  };

  visit(navTree);
  return longestMatch?.item;
};

const toComparablePath = (navItemUrl: string, subUrlPrefix: string): string => {
  const pathOnly = navItemUrl.split(/[?#]/, 1)[0];
  const unprefixed = subUrlPrefix && pathOnly.startsWith(subUrlPrefix) ? pathOnly.slice(subUrlPrefix.length) : pathOnly;
  return withoutTrailingSlash(unprefixed);
};

const withoutTrailingSlash = (path: string): string => path.replace(/\/+$/, '') || '/';
