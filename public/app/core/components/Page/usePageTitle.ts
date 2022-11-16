import { useEffect } from 'react';

import { NavModel, NavModelItem } from '@grafana/data';

import { Branding } from '../Branding/Branding';

export function usePageTitle(navModel?: NavModel, pageNav?: NavModelItem) {
  useEffect(() => {
    const parts: string[] = [];
    if (pageNav) {
      addTitleSegment(parts, pageNav);
    } else if (navModel) {
      if (navModel.node !== navModel.main) {
        addTitleSegment(parts, navModel.node);
      } else {
        addTitleSegment(parts, navModel.main);
      }
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
