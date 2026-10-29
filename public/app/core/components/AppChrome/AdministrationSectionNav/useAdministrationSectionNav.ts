import { useLocation } from 'react-router-dom-v5-compat';

import { locationUtil, type NavModelItem } from '@grafana/data';
import { useFlagGrafanaNavigationAdminSubNav } from '@grafana/runtime/internal';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { NavID } from 'app/core/navtree/constants';
import { useSelector } from 'app/types/store';

import { getActiveItem } from '../MegaMenu/utils';

export interface AdministrationSectionNavModel {
  /** Destinations that sit directly under Administration, outside any group */
  ungrouped: NavModelItem[];
  /** Groups with at least one destination */
  groups: NavModelItem[];
  activeId?: string;
}

function findByPath(items: NavModelItem[], pathname: string): NavModelItem | undefined {
  let best: NavModelItem | undefined;
  let bestLength = 0;
  const visit = (list: NavModelItem[]) => {
    for (const item of list) {
      const path = item.url ? locationUtil.stripBaseFromUrl(item.url).split(/[?#]/)[0] : '';
      const isMatch = path.length > 1 && (pathname === path || pathname.startsWith(`${path}/`));
      if (!item.children && isMatch && path.length > bestLength) {
        best = item;
        bestLength = path.length;
      }
      if (item.children) {
        visit(item.children);
      }
    }
  };
  visit(items);
  return best;
}

/**
 * The model for the section nav shown beside Administration pages, or undefined
 * when it should not show: flag off, a page outside Administration, or a screen
 * too narrow for a side panel. The URL decides first, because the chrome's page
 * state only catches up after the page has rendered, which would flash the
 * layout without the panel.
 */
export function useAdministrationSectionNav(
  currentPage: NavModelItem | undefined
): AdministrationSectionNavModel | undefined {
  const enabled = useFlagGrafanaNavigationAdminSubNav();
  const fitsSidePanel = useMediaQueryMinWidth('md');
  const navTree = useSelector((state) => state.navBarTree);
  const { pathname } = useLocation();

  const administration = navTree.find((item) => item.id === NavID.cfg);
  if (!enabled || !fitsSidePanel || !administration) {
    return undefined;
  }

  const destinations = (administration.children ?? []).filter((child) => !child.isCreateAction);
  const matchedByPath = findByPath(destinations, pathname);
  const active = matchedByPath ?? (currentPage ? getActiveItem(destinations, currentPage) : undefined);
  const isLanding = pathname === administration.url || currentPage?.id === NavID.cfg;
  if (!active && !isLanding) {
    return undefined;
  }

  return {
    ungrouped: destinations.filter((child) => !child.children),
    groups: destinations
      .filter((child) => child.children?.some((grandchild) => !grandchild.isCreateAction))
      .map((group) => ({ ...group, children: group.children?.filter((child) => !child.isCreateAction) })),
    activeId: active?.id,
  };
}
