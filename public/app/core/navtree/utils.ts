import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { NavID } from './constants';

export const hasAny = (...actions: string[]) => actions.some((action) => contextSrv.hasPermission(action));
export const isSignedIn = () => contextSrv.isSignedIn;

export interface NavEntryBuilder {
  /** Whether this item is visible at all (permission/config/sign-in gates); absent means always visible */
  when?: () => boolean;
  /** Builds the nav item; may return undefined when, despite the gate, no
   * accessible children remain (e.g. Alerting with no alerting permissions) */
  build: () => NavModelItem | undefined;
}

export const buildEntries = (entries: NavEntryBuilder[]): NavModelItem[] =>
  entries
    .filter((entry) => entry.when?.() ?? true)
    .map((entry) => entry.build())
    .filter((item) => !!item);

// Admin subsections that exist as attachment targets for plugin pages and
// registered enterprise items, pruned when nothing attached
const PRUNABLE_ADMIN_SECTIONS: string[] = [NavID.cfgGeneral, NavID.cfgPlugins, NavID.cfgAccess];

/** Depth-first search of a nav tree by item id */
export function findNavById(nodes: NavModelItem[], id: string): NavModelItem | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const found = node.children && findNavById(node.children, id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Prefixes every absolute url in the tree with the app sub url, so individual
 * items are declared sub-url agnostic. Anchor-only and relative urls (Help's
 * `#`) are left alone. Keying off the leading slash is safe because the
 * prefix is applied exactly once per build pipeline, before any
 * already-prefixed runtime content is copied in. Returns a new tree.
 */
export function applyAppSubUrl(tree: NavModelItem[]): NavModelItem[] {
  if (!config.appSubUrl) {
    return tree;
  }
  return tree.map((node) => ({
    ...node,
    url: node.url?.startsWith('/') ? `${config.appSubUrl}${node.url}` : node.url,
    children: node.children ? applyAppSubUrl(node.children) : node.children,
  }));
}

/**
 * Stable sort by sortWeight, applied recursively; items without a weight keep
 * their insertion position. Returns a new tree.
 */
export function sortNavTree(nodes: NavModelItem[]): NavModelItem[] {
  const weightOf = (node: NavModelItem, index: number) => node.sortWeight || index + 1;

  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => weightOf(a.node, a.index) - weightOf(b.node, b.index) || a.index - b.index)
    .map(({ node }) => (node.children ? { ...node, children: sortNavTree(node.children) } : node));
}

/**
 * Removes attachment-target shells that ended up empty: the admin subsections
 * (PRUNABLE_ADMIN_SECTIONS) and the top-level Connections and Administration
 * sections, all built unconditionally so plugin pages and registered items
 * can attach, then dropped when nothing did. Returns a new tree.
 */
export function pruneEmptyNavSections(tree: NavModelItem[]): NavModelItem[] {
  const isEmpty = (node: NavModelItem) => (node.children ?? []).length === 0;

  return tree
    .map((node) => {
      if (node.id !== NavID.cfg || !node.children) {
        return node;
      }
      return {
        ...node,
        children: node.children.filter(
          (child) => !(child.id && PRUNABLE_ADMIN_SECTIONS.includes(child.id) && isEmpty(child))
        ),
      };
    })
    .filter((node) => !((node.id === NavID.cfg || node.id === NavID.connections) && isEmpty(node)));
}
