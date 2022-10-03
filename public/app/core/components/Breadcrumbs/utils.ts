import { NavModelItem } from '@grafana/data';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(homeNav: NavModelItem, sectionNav: NavModelItem, pageNav?: NavModelItem) {
  const crumbs: Breadcrumb[] = [];
  let foundHome = false;

  function addCrumbs(node: NavModelItem) {
    // extract the pathname from the url
    const urlPathname = node.url?.split('?')[0];
    if (!foundHome && !node.hideFromBreadcrumbs) {
      if (urlPathname === homeNav.url) {
        crumbs.unshift({ text: homeNav.text, href: node.url ?? '' });
        foundHome = true;
      } else {
        crumbs.unshift({ text: node.text, href: node.url ?? '' });
      }
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
