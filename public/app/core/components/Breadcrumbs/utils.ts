import { NavModelItem } from '@grafana/data';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(sectionNav: NavModelItem, pageNav?: NavModelItem, homeNav?: NavModelItem) {
  const crumbs: Breadcrumb[] = [];
  let foundHome = false;
  let lastPath: string | undefined = undefined;

  function addCrumbs(node: NavModelItem) {
    if (foundHome) {
      return;
    }

    // construct the URL to match
    const urlParts = node.url?.split('?') ?? ['', ''];
    let urlToMatch = urlParts[0];

    // Check if we found home/root if if so return early
    if (homeNav && urlToMatch === homeNav.url) {
      crumbs.unshift({ text: homeNav.text, href: node.url ?? '' });
      foundHome = true;
      return;
    }

    // This enabled app plugins to control breadcrumbs of their root pages
    const isSamePathAsLastBreadcrumb = urlToMatch.length > 0 && lastPath === urlToMatch;
    // Remember this path for the next breadcrumb
    lastPath = urlToMatch;

    if (!node.hideFromBreadcrumbs && !isSamePathAsLastBreadcrumb) {
      crumbs.unshift({ text: node.text, href: node.url ?? '' });
    }

    if (node.parentItem) {
      addCrumbs(node.parentItem);
    }
  }

  if (pageNav) {
    addCrumbs(pageNav);
  }

  addCrumbs(sectionNav);

  return crumbs;
}
