import { useSyncExternalStore } from 'react';

import { locationUtil, type NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useFlagGrafanaNavigationAdminSubNav } from '@grafana/runtime/internal';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { NavID } from 'app/core/navtree/constants';
import { useSelector } from 'app/types/store';

import { getActiveItem } from '../MegaMenu/utils';

export interface AdministrationSectionNavModel {
  /** Groups with at least one destination */
  groups: NavModelItem[];
  activeId?: string;
}

function isUnderDestination(items: NavModelItem[], pathname: string): boolean {
  return items.some((item) => {
    if (item.children) {
      return isUnderDestination(item.children, pathname);
    }
    const path = item.url ? locationUtil.stripBaseFromUrl(item.url).split(/[?#]/)[0] : '';
    return path.length > 1 && (pathname === path || pathname.startsWith(`${path}/`));
  });
}

function subscribeToPathname(onChange: () => void) {
  const subscription = locationService.getLocationObservable().subscribe(onChange);
  return () => subscription.unsubscribe();
}

function getPathname() {
  return locationService.getLocation().pathname;
}

/**
 * The model for the section nav shown beside Administration pages, or undefined
 * when it should not show: flag off, a page outside Administration, or a screen
 * too narrow for a side panel. The URL decides whether it shows, because the
 * chrome's page state only catches up after the page has rendered, which would
 * flash the layout without the panel. The page's own nav item decides what is
 * marked current, as it does for breadcrumbs.
 */
export function useAdministrationSectionNav(
  currentPage: NavModelItem | undefined
): AdministrationSectionNavModel | undefined {
  const enabled = useFlagGrafanaNavigationAdminSubNav();
  const fitsSidePanel = useMediaQueryMinWidth('md');
  const navTree = useSelector((state) => state.navBarTree);

  const pathname = useSyncExternalStore(subscribeToPathname, getPathname);

  const administration = navTree.find((item) => item.id === NavID.cfg);
  if (!enabled || !fitsSidePanel || !administration) {
    return undefined;
  }

  const destinations = (administration.children ?? []).filter((child) => !child.isCreateAction);
  const active = currentPage ? getActiveItem(destinations, currentPage) : undefined;
  const isLanding = pathname === administration.url || currentPage?.id === NavID.cfg;
  if (!active && !isLanding && !isUnderDestination(destinations, pathname)) {
    return undefined;
  }

  return {
    groups: destinations
      .filter((child) => child.children?.some((grandchild) => !grandchild.isCreateAction))
      .map((group) => ({ ...group, children: group.children?.filter((child) => !child.isCreateAction) })),
    activeId: active?.id,
  };
}
