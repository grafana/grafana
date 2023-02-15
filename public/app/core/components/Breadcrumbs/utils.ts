import { NavModelItem } from '@grafana/data';

import { Breadcrumb } from './types';

export function buildBreadcrumbs(sectionNav: NavModelItem, pageNav?: NavModelItem, homeNav?: NavModelItem) {
  const crumbs: Breadcrumb[] = [];
  let foundHome = false;

  function addCrumbs(node: NavModelItem) {
    // construct the URL to match
    // we want to ignore query params except for the editview query param
    const urlSearchParams = new URLSearchParams(node.url?.split('?')[1]);
    let urlToMatch = `${node.url?.split('?')[0]}`;
    if (urlSearchParams.has('editview')) {
      urlToMatch += `?editview=${urlSearchParams.get('editview')}`;
    }

    if (!foundHome && !node.hideFromBreadcrumbs) {
      if (homeNav && urlToMatch === homeNav.url) {
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
    if (pageNav.url && pageNav.children) {
      const child = pageNav.children.find((child) => child.active);
      if (child) {
        addCrumbs(child);
        // Some pages set up children but they are not connected to parent pageNav
        if (child.parentItem !== pageNav) {
          addCrumbs(pageNav);
        }
      }
    } else {
      addCrumbs(pageNav);
    }
  }

  addCrumbs(sectionNav);

  return crumbs;
}
