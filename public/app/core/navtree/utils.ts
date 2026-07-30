import { type NavModelItem, userHasAnyPermission } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { NavID, type NavId } from './constants';

export const hasAny = (...actions: string[]) => userHasAnyPermission(actions, contextSrv.user);
export const isSignedIn = () => contextSrv.isSignedIn;
export const anonymousOrSignedIn = () => isSignedIn() || config.anonymousEnabled;
export const isOrgAdmin = () => contextSrv.user.orgRole === 'Admin';

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
const PRUNABLE_ADMIN_SECTIONS: NavId[] = [NavID.cfgGeneral, NavID.cfgPlugins, NavID.cfgAccess];

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

/** Returns a new tree with the matching node (at any depth) replaced by update(node) */
export function updateNavById(
  nodes: NavModelItem[],
  id: string,
  update: (node: NavModelItem) => NavModelItem
): NavModelItem[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return update(node);
    }
    return node.children ? { ...node, children: updateNavById(node.children, id, update) } : node;
  });
}

/** Returns a new tree without the matching node (at any depth) */
export function removeNavById(nodes: NavModelItem[], id: string): NavModelItem[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeNavById(node.children, id) } : node));
}

/**
 * Prefixes every absolute url in the tree with the app sub url, so individual
 * items are declared sub-url agnostic. Anchor-only and relative urls (Help's
 * `#`) are left alone. Keying off the leading slash is safe because the
 * prefix is applied exactly once per build pipeline, before any
 * already-prefixed runtime content is copied in.
 *
 * Reads config.appSubUrl directly rather than locationUtil.assureBaseUrl:
 * getInitialNavTree runs during configureStore, before app.ts calls
 * locationUtil.initialize, so locationUtil's config is still empty here.
 * Returns a new tree.
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
    .sort((a, b) => weightOf(a.node, a.index) - weightOf(b.node, b.index))
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
          (child) => !(child.id && PRUNABLE_ADMIN_SECTIONS.some((id) => id === child.id) && isEmpty(child))
        ),
      };
    })
    .filter((node) => !((node.id === NavID.cfg || node.id === NavID.connections) && isEmpty(node)));
}
