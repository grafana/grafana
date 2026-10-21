import { type NavModelItem } from '@grafana/data';

/**
 * Walks the nav tree and returns the deepest nav item whose URL best matches the given pathname.
 * Exact matches win over ancestor-prefix matches; among ancestor matches, the longest URL wins so
 * nested routes resolve to their closest nav entry. Trailing slashes are ignored on both sides.
 */
export const findNavItemForPath = (navTree: NavModelItem[], pathname: string): NavModelItem | undefined => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  let longestMatch: { url: string; item: NavModelItem } | undefined;

  const visit = (items: NavModelItem[]) => {
    for (const item of items) {
      if (item.url && item.text) {
        const itemUrl = item.url.replace(/\/+$/, '') || '/';
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
