import { NavModelItem } from '@grafana/data';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(sectionNav: NavModelItem, pageNav?: NavModelItem, homeNav?: NavModelItem) {
  const crumbs: Breadcrumb[] = [];
  let foundHome = false;
  let lastPath: string | undefined = undefined;

  function addCrumbs(node: NavModelItem, shouldDedupe = false) {
    if (foundHome) {
      return;
    }

    // construct the URL to match
    const urlParts = node.url?.split('?') ?? ['', ''];
    let urlToMatch = urlParts[0];
    const urlSearchParams = new URLSearchParams(urlParts[1]);
    if (urlSearchParams.has('editview')) {
      urlToMatch += `?editview=${urlSearchParams.get('editview')}`;
    }

    // Check if we found home/root if if so return early
    if (homeNav && urlToMatch === homeNav.url) {
      foundHome = true;
      return;
    }

    const isSamePathAsLastBreadcrumb = urlToMatch.length > 0 && lastPath === urlToMatch;

    // Remember this path for the next breadcrumb
    lastPath = urlToMatch;

    const shouldAddCrumb = !node.hideFromBreadcrumbs && !(shouldDedupe && isSamePathAsLastBreadcrumb);

    if (shouldAddCrumb) {
      const activeChildIndex = node.children?.findIndex((child) => child.active) ?? -1;
      // Add active tab to breadcrumbs if it exists and its URL is different from the node's URL
      // This ensures tabs show in breadcrumbs (including the first tab) while preventing duplication
      if (activeChildIndex >= 0) {
        const activeChild = node.children?.[activeChildIndex];
        if (activeChild) {
          // Only add the active child if its URL doesn't match the node's URL
          // This prevents duplication when the pageNav is the active tab
          const nodeUrl = node.url?.split('?')[0] ?? '';
          const childUrl = activeChild.url?.split('?')[0] ?? '';
          if (nodeUrl !== childUrl) {
            crumbs.unshift({ text: activeChild.text, href: activeChild.url ?? '' });
          }
        }
      }
      crumbs.unshift({ text: node.text, href: node.url ?? '' });
    }

    if (node.parentItem) {
      addCrumbs(node.parentItem);
    }
  }

  if (pageNav) {
    addCrumbs(pageNav);
  }

  // shouldDedupe = true enables app plugins to control breadcrumbs of their root pages
  addCrumbs(sectionNav, true);

  return crumbs;
}
