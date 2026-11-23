import { type NavModelItem } from '@grafana/data';

import { toComparablePath } from '../../navigation/comparablePath';

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
  const normalizedPath = toComparablePath(pathname);
  let longestMatch: { url: string; item: NavModelItem } | undefined;

  const visit = (items: NavModelItem[]) => {
    for (const item of items) {
      if (item.url && item.text) {
        const itemUrl = toComparablePath(item.url, appSubUrl);
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
