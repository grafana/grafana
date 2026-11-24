import { useMemo, useSyncExternalStore } from 'react';

import { locationUtil, type NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { getActiveItem, hiddenKey } from '../MegaMenu/utils';

export interface SectionNavModel {
  /** Groups with at least one destination */
  groups: NavModelItem[];
  /** The key of the current link, as hiddenKey gives it */
  activeId?: string;
}

function toPathname(url?: string): string {
  return url ? locationUtil.stripBaseFromUrl(url).split(/[?#]/)[0] : '';
}

const PLUGIN_ROOT = /^\/a\/[^/]+/;

// How much of the item's URL the pathname is at or under, or 0. A plugin page's nav item can point
// at one of its routes (such as /home) while the plugin's other routes are the same destination
function matchLength(item: NavModelItem, pathname: string): number {
  const path = toPathname(item.url);
  const roots = [path, path.match(PLUGIN_ROOT)?.[0] ?? ''];
  return Math.max(
    0,
    ...roots.map((root) =>
      root.length > 1 && (pathname === root || pathname.startsWith(`${root}/`)) ? root.length : 0
    )
  );
}

function isUnderDestination(items: NavModelItem[], pathname: string): boolean {
  return items.some(
    (item) => matchLength(item, pathname) > 0 || (item.children ? isUnderDestination(item.children, pathname) : false)
  );
}

// The item with the longest matching URL, or none when two match equally: several pages of one
// plugin share its root, so its landing page names none of them. Plugin pages describe themselves
// to the chrome with ids of their own, so the page's nav item alone does not always find them
function findByPathname(items: NavModelItem[], pathname: string): NavModelItem | undefined {
  let best: { item: NavModelItem; length: number; tied: boolean } | undefined;
  const visit = (nodes: NavModelItem[]) => {
    for (const node of nodes) {
      const length = matchLength(node, pathname);
      if (length > (best?.length ?? 0)) {
        best = { item: node, length, tied: false };
      } else if (best && length === best.length) {
        best.tied = true;
      }
      if (node.children) {
        visit(node.children);
      }
    }
  };
  visit(items);
  return best?.tied ? undefined : best?.item;
}

// The link in the panel that an item belongs to: the item itself, or the link it is nested under
function findLink(groups: NavModelItem[], target: NavModelItem | undefined): NavModelItem | undefined {
  const targetKey = target && hiddenKey(target);
  const contains = (node: NavModelItem): boolean =>
    node === target || (targetKey && hiddenKey(node) === targetKey) || Boolean(node.children?.some(contains));
  return target ? groups.flatMap((group) => group.children ?? []).find(contains) : undefined;
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
    const groups = destinations
      .filter((child) => child.children?.some((grandchild) => !grandchild.isCreateAction))
      .map((group) => ({ ...group, children: group.children?.filter((child) => !child.isCreateAction) }));
    const links = groups.flatMap((group) => group.children ?? []);
    const active =
      (currentPage ? getActiveItem(destinations, currentPage) : undefined) ?? findByPathname(links, pathname);
    const isLanding = pathname === toPathname(section.url) || currentPage?.id === sectionId;
    if (!active && !isLanding && !isUnderDestination(destinations, pathname)) {
      return undefined;
    }

    const activeLink = findLink(groups, active);
    return { groups, activeId: activeLink && hiddenKey(activeLink) };
  }, [sectionId, enabled, navTree, pathname, currentPage]);
}
