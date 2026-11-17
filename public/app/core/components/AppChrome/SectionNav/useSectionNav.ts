import { useMemo, useSyncExternalStore } from 'react';

import { locationUtil, type NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { getActiveItem } from '../MegaMenu/utils';

export interface SectionNavModel {
  /** Groups with at least one destination */
  groups: NavModelItem[];
  activeId?: string;
}

function toPathname(url?: string): string {
  return url ? locationUtil.stripBaseFromUrl(url).split(/[?#]/)[0] : '';
}

function isUnderDestination(items: NavModelItem[], pathname: string): boolean {
  return items.some((item) => {
    const path = toPathname(item.url);
    if (path.length > 1 && (pathname === path || pathname.startsWith(`${path}/`))) {
      return true;
    }
    return item.children ? isUnderDestination(item.children, pathname) : false;
  });
}

// The longest destination URL the pathname is at or under. Plugin pages describe themselves to the
// chrome with ids of their own, so the page's nav item alone does not always find them in the tree
function findByPathname(items: NavModelItem[], pathname: string): NavModelItem | undefined {
  let best: { item: NavModelItem; length: number } | undefined;
  const visit = (nodes: NavModelItem[]) => {
    for (const node of nodes) {
      const path = toPathname(node.url);
      const matches = path.length > 1 && (pathname === path || pathname.startsWith(`${path}/`));
      if (!node.children && matches && (!best || path.length > best.length)) {
        best = { item: node, length: path.length };
      }
      if (node.children) {
        visit(node.children);
      }
    }
  };
  visit(items);
  return best?.item;
}

function subscribeToPathname(onChange: () => void) {
  const subscription = locationService.getLocationObservable().subscribe(onChange);
  return () => subscription.unsubscribe();
}

function getPathname() {
  return locationService.getLocation().pathname;
}

/**
 * The model for the section nav shown beside a section's pages, or undefined
 * when it should not show: not enabled or a page outside the section. The URL decides whether it shows, because the
 * chrome's page state only catches up after the page has rendered, which would
 * flash the layout without the panel. The page's own nav item decides what is
 * marked current, as it does for breadcrumbs.
 */
export function useSectionNav(
  sectionId: string,
  enabled: boolean,
  currentPage: NavModelItem | undefined
): SectionNavModel | undefined {
  const navTree = useSelector((state) => state.navBarTree);

  const pathname = useSyncExternalStore(subscribeToPathname, getPathname);

  // Stable between renders, as it is handed to the chrome to hold
  return useMemo(() => {
    const section = navTree.find((item) => item.id === sectionId);
    if (!enabled || !section) {
      return undefined;
    }

    const destinations = (section.children ?? []).filter((child) => !child.isCreateAction);
    const active =
      (currentPage ? getActiveItem(destinations, currentPage) : undefined) ?? findByPathname(destinations, pathname);
    const isLanding = pathname === toPathname(section.url) || currentPage?.id === sectionId;
    if (!active && !isLanding && !isUnderDestination(destinations, pathname)) {
      return undefined;
    }

    return {
      groups: destinations
        .filter((child) => child.children?.some((grandchild) => !grandchild.isCreateAction))
        .map((group) => ({ ...group, children: group.children?.filter((child) => !child.isCreateAction) })),
      activeId: active?.id,
    };
  }, [sectionId, enabled, navTree, pathname, currentPage]);
}
