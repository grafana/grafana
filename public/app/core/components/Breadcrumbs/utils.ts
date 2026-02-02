import { NavModelItem } from '@grafana/data';
import { DashFolderLinkRegexp, t } from 'app/core/internationalization';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(
  sectionNav: NavModelItem,
  pageNav?: NavModelItem,
  homeNav?: NavModelItem,
  skipHome?: boolean
) {
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
      if (!skipHome) {
        crumbs.unshift({ text: homeNav.text, href: node.url ?? '' });
      }
      foundHome = true;
      return;
    }

    const isSamePathAsLastBreadcrumb = urlToMatch.length > 0 && lastPath === urlToMatch;

    // Remember this path for the next breadcrumb
    lastPath = urlToMatch;

    const shouldAddCrumb = !node.hideFromBreadcrumbs && !(shouldDedupe && isSamePathAsLastBreadcrumb);

    if (shouldAddCrumb) {
      const activeChildIndex = node.children?.findIndex((child) => child.active) ?? -1;
      // Add tab to breadcrumbs if it's not the first active child
      if (activeChildIndex > 0) {
        const activeChild = node.children?.[activeChildIndex];
        if (activeChild) {
          // BMC Change: To add localized name in breadcrumbs
          addLocalizedCrumbs(activeChild, crumbs);
          // BMC Change: Ends
        }
      }
      // BMC Change: To add localized name in breadcrumbs
      addLocalizedCrumbs(node, crumbs);
      // BMC Change: Ends
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

// BMC Change: To add localized name in breadcrumbs
function addLocalizedCrumbs(node: NavModelItem, crumbs: Breadcrumb[]) {
  let text = node.text;
  const match = node.url?.match(DashFolderLinkRegexp);
  if (match) {
    // to be ignored for extraction
    text = t(`bmc-dynamic.${match[1]}.name`, text);
  }
  crumbs.unshift({ text: text, href: node.url ?? '' });
}
