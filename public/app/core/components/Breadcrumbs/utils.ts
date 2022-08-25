import { NavModelItem } from '@grafana/data';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(sectionNav: NavModelItem, pageNav?: NavModelItem) {
  const crumbs: Breadcrumb[] = [{ icon: 'home-alt', href: '/', text: 'Home' }];

  function addCrumbs(node: NavModelItem) {
    if (node.parentItem) {
      addCrumbs(node.parentItem);
    }

    if (!node.hideFromBreadcrumbs) {
      crumbs.push({ text: node.text, href: node.url ?? '' });
    }
  }

  addCrumbs(sectionNav);

  if (pageNav) {
    addCrumbs(pageNav);
  }

  return crumbs;
}
