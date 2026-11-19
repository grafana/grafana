import { locationUtil, type NavModelItem } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { NavID } from 'app/core/navtree/constants';

import { type Breadcrumb } from './types';

// With the Administration section nav, these overview pages are replaced by it, so a breadcrumb
// names them without taking the user back to one
const ADMIN_OVERVIEW_IDS = new Set<string>([NavID.cfg, NavID.cfgAccess, NavID.cfgPlugins]);

const isAdminOverview = (node: NavModelItem) =>
  node.id !== undefined &&
  ADMIN_OVERVIEW_IDS.has(node.id) &&
  getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNavigationAdminSubNav, false);

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
      // Add tab to breadcrumbs if it's not the first active child
      if (activeChildIndex > 0) {
        const activeChild = node.children?.[activeChildIndex];
        if (activeChild) {
          crumbs.unshift({ text: activeChild.text, href: locationUtil.assureBaseUrl(activeChild.url ?? '') });
        }
      }
      crumbs.unshift({
        text: node.text,
        ...(isAdminOverview(node) ? {} : { href: locationUtil.assureBaseUrl(node.url ?? '') }),
        ...(node.highlightText ? { highlightText: node.highlightText } : {}),
      });
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
