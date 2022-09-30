import { NavModelItem } from '@grafana/data';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(homeNav: NavModelItem, sectionNav: NavModelItem, pageNav?: NavModelItem) {
  const crumbs: Breadcrumb[] = [];
  let foundHome = false;

  function addCrumbs(node: NavModelItem) {
    if (!foundHome && !node.hideFromBreadcrumbs) {
      if (node.url === homeNav.url) {
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
