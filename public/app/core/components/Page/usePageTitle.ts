import { useEffect } from 'react';

import { NavModel, NavModelItem } from '@grafana/data';

import { Branding } from '../Branding/Branding';

export function usePageTitle(navModel?: NavModel, pageNav?: NavModelItem) {
  const homeNav = useSelector((state) => state.navIndex)?.[HOME_NAV_ID];

  useEffect(() => {
    const parts: string[] = [];
    if (pageNav) {
      if (pageNav.children) {
        const activePage = pageNav.children.find((x) => x.active);
        if (activePage) {
          addTitleSegment(parts, activePage);
        }
      }
      addTitleSegment(parts, pageNav);
    }

    if (navModel) {
      if (navModel.node !== navModel.main) {
        addTitleSegment(parts, navModel.node);
      }
      addTitleSegment(parts, navModel.main);
    }

    parts.push(Branding.AppTitle);

    document.title = parts.join(' - ');
  }, [navModel, pageNav]);
}

function addTitleSegment(parts: string[], node: NavModelItem) {
  if (!node.hideFromBreadcrumbs) {
    parts.push(node.text);
  }
}
