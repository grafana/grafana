import { type NavModelItem } from '@grafana/data';

import {
  ALWAYS_PRIMARY_IDS,
  DEFAULT_PINNED_IDS,
  MEGA_MENU_EXCLUDED_IDS,
  UNPINNABLE_IDS,
} from './constants';
import { resolveLayout } from './migrateLayout';
import { buildNavIndex, getNodeKey, type NavNodeRef } from './navIndex';
import { type NavLayoutConfig, type ProjectedNavTree } from './types';

export interface ProjectNavTreeOptions {
  layout?: NavLayoutConfig;
  bookmarkUrls?: string[];
  pathname?: string;
}

export function materializePinnedIds(layout: NavLayoutConfig, index: Map<string, NavNodeRef>): string[] {
  if (layout.pinnedIds !== undefined) {
    return layout.pinnedIds.filter((id) => index.has(id) || ALWAYS_PRIMARY_IDS.has(id));
  }

  return DEFAULT_PINNED_IDS.filter((id) => index.has(id) || ALWAYS_PRIMARY_IDS.has(id));
}

export function getEffectivePinnedIds(
  layout: NavLayoutConfig,
  index: Map<string, NavNodeRef>
): Set<string> {
  return new Set(materializePinnedIds(layout, index));
}

export function isPinned(id: string | undefined, pinnedSet: Set<string>): boolean {
  if (!id) {
    return false;
  }
  if (ALWAYS_PRIMARY_IDS.has(id)) {
    return true;
  }
  return pinnedSet.has(id);
}

export function canPinItem(id: string | undefined): boolean {
  return Boolean(id && !UNPINNABLE_IDS.has(id));
}

function buildBreadcrumb(parentChain: NavModelItem[]): string {
  return parentChain.map((p) => p.text).join(' › ');
}

function cloneForPrimary(node: NavModelItem, parentChain: NavModelItem[], promoted: boolean): NavModelItem {
  const breadcrumb = promoted && parentChain.length > 0 ? buildBreadcrumb(parentChain) : undefined;
  return {
    ...node,
    subTitle: breadcrumb ?? node.subTitle,
    children: promoted ? undefined : node.children ? [...node.children] : undefined,
  };
}

function filterOverflowTree(
  nodes: NavModelItem[],
  pinnedSet: Set<string>,
  promotedIds: Set<string>,
  index: Map<string, NavNodeRef>
): NavModelItem[] {
  const result: NavModelItem[] = [];

  for (const node of nodes) {
    const key = getNodeKey(node);
    if (!key) {
      continue;
    }

    if (MEGA_MENU_EXCLUDED_IDS.has(key)) {
      continue;
    }

    const ref = index.get(key);
    const isTopLevelPinned = ref?.isTopLevel && pinnedSet.has(key);

    if (isTopLevelPinned) {
      continue;
    }

    if (promotedIds.has(key)) {
      continue;
    }

    let children: NavModelItem[] | undefined;
    if (node.children?.length) {
      children = filterOverflowTree(node.children, pinnedSet, promotedIds, index);
    }

    if (ref?.isTopLevel || (children && children.length > 0) || (node.url && !promotedIds.has(key))) {
      const hasVisibleChild = children && children.length > 0;
      const isLeaf = !node.children?.length;

      if (isLeaf && promotedIds.has(key)) {
        continue;
      }

      if (!isLeaf && !hasVisibleChild && !pinnedSet.has(key)) {
        continue;
      }

      result.push({
        ...node,
        children: hasVisibleChild ? children : isLeaf ? undefined : children,
      });
    }
  }

  return result;
}

function sortPrimaryItems(items: NavModelItem[], order: string[] | undefined): NavModelItem[] {
  if (!order?.length) {
    return items.sort((a, b) => (a.sortWeight ?? 0) - (b.sortWeight ?? 0));
  }

  const orderMap = new Map(order.map((id, i) => [id, i]));

  return [...items].sort((a, b) => {
    const aKey = a.id ?? '';
    const bKey = b.id ?? '';
    const aOrder = orderMap.get(aKey);
    const bOrder = orderMap.get(bKey);

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }
    if (aOrder !== undefined) {
      return -1;
    }
    if (bOrder !== undefined) {
      return 1;
    }
    return (a.sortWeight ?? 0) - (b.sortWeight ?? 0);
  });
}

export function projectNavTree(
  canonicalTree: NavModelItem[],
  options: ProjectNavTreeOptions = {}
): ProjectedNavTree {
  const filteredTree = canonicalTree.filter((item) => !MEGA_MENU_EXCLUDED_IDS.has(item.id ?? ''));
  const layout = resolveLayout(options.layout, options.bookmarkUrls, canonicalTree);
  const index = buildNavIndex(canonicalTree);
  const pinnedSet = getEffectivePinnedIds(layout, index);

  const promotedIds = new Set<string>();
  const primary: NavModelItem[] = [];

  for (const id of pinnedSet) {
    if (ALWAYS_PRIMARY_IDS.has(id)) {
      continue;
    }
    const ref = index.get(id);
    if (!ref) {
      continue;
    }
    if (ref.isTopLevel) {
      continue;
    }
    promotedIds.add(id);
  }

  for (const node of filteredTree) {
    const key = getNodeKey(node);
    if (!key) {
      continue;
    }

    if (ALWAYS_PRIMARY_IDS.has(key)) {
      primary.push({ ...node });
      continue;
    }

    if (key === 'starred') {
      primary.push({ ...node });
      continue;
    }

    if (pinnedSet.has(key) && !promotedIds.has(key)) {
      primary.push(cloneForPrimary(node, [], false));
    }
  }

  for (const id of promotedIds) {
    const ref = index.get(id);
    if (ref) {
      primary.push(cloneForPrimary(ref.node, ref.parentChain, true));
    }
  }

  const overflow = filterOverflowTree(filteredTree, pinnedSet, promotedIds, index);

  let expandedOverflow = layout.expandedOverflow ?? false;
  if (options.pathname && !expandedOverflow) {
    expandedOverflow = overflowHasActiveMatch(overflow, options.pathname, index);
  }

  return {
    primary: sortPrimaryItems(primary, layout.order),
    overflow,
    expandedOverflow,
  };
}

function overflowHasActiveMatch(
  overflow: NavModelItem[],
  pathname: string,
  index: Map<string, NavNodeRef>
): boolean {
  for (const [, ref] of index) {
    if (ref.node.url && pathname.startsWith(ref.node.url) && ref.node.url !== '/') {
      const key = getNodeKey(ref.node);
      if (!key) {
        continue;
      }
      const inOverflow = overflow.some((n) => containsNode(n, ref.node.id ?? ''));
      if (inOverflow) {
        return true;
      }
    }
  }
  return false;
}

function containsNode(node: NavModelItem, id: string): boolean {
  if (node.id === id) {
    return true;
  }
  return Boolean(node.children?.some((c) => containsNode(c, id)));
}

export function togglePin(layout: NavLayoutConfig, id: string, index: Map<string, NavNodeRef>): NavLayoutConfig {
  const next = new Set(materializePinnedIds(layout, index));

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return {
    ...layout,
    version: layout.version ?? 1,
    pinnedIds: Array.from(next).filter((pid) => !UNPINNABLE_IDS.has(pid)),
  };
}

export function reorderPrimary(
  layout: NavLayoutConfig,
  sourceId: string,
  destinationId: string,
  primaryIds: string[]
): NavLayoutConfig {
  const order = layout.order?.length ? [...layout.order] : [...primaryIds];
  const sourceIndex = order.indexOf(sourceId);
  const destIndex = order.indexOf(destinationId);

  if (sourceIndex === -1 || destIndex === -1) {
    return layout;
  }

  order.splice(sourceIndex, 1);
  order.splice(destIndex, 0, sourceId);

  return {
    ...layout,
    version: layout.version ?? 1,
    order,
  };
}
