import { type NavModelItem, userHasAnyPermission } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';

import { NavID, type NavId } from './constants';

/**
 * Whether to build the nav tree client-side. Gated on grafana.multiTenantNavTree
 * alone: this covers the static sections, which need no plugin data. Folding in
 * app plugin nav is gated separately on plugins.useMTPlugins, below (the metas
 * API it depends on additionally needs pluginStoreServiceLoading and
 * pluginInstallAPISync server-side).
 *
 * The backend (setIndexViewData in pkg/api/index.go) only stops building the
 * server tree once plugins.useMTPlugins is also on, so bootData keeps carrying a
 * server-built tree as a fallback throughout the static-only phase.
 *
 * Known gap (fix parked): nothing guarantees the client reaches the same
 * verdict the server did. A failed or slow OFREP fetch resolves against
 * NOOP_PROVIDER, which silently returns the `false` default, and
 * getInitialNavTree then falls back to the bootdata tree.
 *
 * That only bites when both flags are on server-side: the bootdata tree is a
 * real server-built one until then, so falling back to it is harmless. Once
 * plugins.useMTPlugins is on the server ships an empty tree instead, and the
 * menu is empty AND navIndex is {}, making every <Page> render a not-found
 * header. The fix is to have the server publish its decision at boot time (a
 * bootdata boolean alongside the tree) and key off that, rather than
 * re-evaluating the flag here.
 */
export function isClientNavTreeEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantNavTree, false);
}

/**
 * Whether app plugin nav items should be fetched and folded into the tree. On
 * top of the client-build gate this additionally requires plugins.useMTPlugins:
 * without it the pluginMeta service never fetches, so grafana.multiTenantNavTree
 * alone renders the static tree only.
 */
export function arePluginNavItemsEnabled(): boolean {
  return isClientNavTreeEnabled() && getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false);
}

export const hasAny = (...actions: string[]) => userHasAnyPermission(actions, contextSrv.user);
export const isSignedIn = () => contextSrv.isSignedIn;
export const anonymousOrSignedIn = () => isSignedIn() || config.anonymousEnabled;

export interface NavEntryBuilder {
  /** Whether this item is visible at all (permission/config/sign-in gates); absent means always visible */
  when?: () => boolean;
  /** Builds the nav item; may return undefined when, despite the gate, no
   * accessible children remain (e.g. Alerting with no alerting permissions) */
  build: () => NavModelItem | undefined;
}

/**
 * Builds the visible items from a list of entries. A gate or builder that
 * throws costs its own item and nothing else: these run while the redux store
 * is being created, so an uncaught error would abort the whole tree — and with
 * it navIndex — leaving every page rendering a not-found header. Entries come
 * from enterprise and plugin code as well as core, so one bad config read
 * should not be able to do that.
 */
export const buildEntries = (entries: NavEntryBuilder[]): NavModelItem[] =>
  entries
    .map((entry) => {
      try {
        return (entry.when?.() ?? true) ? entry.build() : undefined;
      } catch (error) {
        console.error('[navtree] nav entry failed to build', error);
        return undefined;
      }
    })
    .filter((item) => !!item);

// Admin subsections that exist as attachment targets for plugin pages and
// registered enterprise items, pruned when nothing attached
const PRUNABLE_ADMIN_SECTIONS: NavId[] = [NavID.cfgGeneral, NavID.cfgPlugins, NavID.cfgAccess];

// Top-level sections built unconditionally as attachment targets, pruned when
// nothing attached. Mirrors the server's RemoveEmptyConnectionsSection and
// RemoveEmptyDrilldownSection, plus Administration once its subsections go.
const PRUNABLE_SECTIONS: NavId[] = [NavID.cfg, NavID.connections, NavID.drilldown];

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
 * Appends items into the children of the section with this id, or at the top
 * level for NavID.root. Returns undefined when no such section exists, so the
 * caller decides what that means — the registry skips the item, while the
 * plugin nav builds the section from its shell. Returns a new tree.
 */
export function appendIntoSection(
  tree: NavModelItem[],
  parentId: string,
  items: NavModelItem[]
): NavModelItem[] | undefined {
  if (parentId === NavID.root) {
    return [...tree, ...items];
  }
  if (!findNavById(tree, parentId)) {
    return undefined;
  }
  return updateNavById(tree, parentId, (parent) => ({
    ...parent,
    children: [...(parent.children ?? []), ...items],
  }));
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
 * Removes attachment-target shells that ended up empty, in the server's order:
 * the admin subsections first (PRUNABLE_ADMIN_SECTIONS), then the top-level
 * sections (PRUNABLE_SECTIONS) — so Administration goes once its last
 * subsection does. Mirrors RemoveEmptyAdminSections,
 * RemoveEmptyConnectionsSection and RemoveEmptyDrilldownSection. Returns a new
 * tree.
 */
export function pruneEmptyNavSections(tree: NavModelItem[]): NavModelItem[] {
  const isEmpty = (node: NavModelItem) => (node.children ?? []).length === 0;
  const isPrunable = (ids: NavId[], node: NavModelItem) =>
    Boolean(node.id) && ids.some((id) => id === node.id) && isEmpty(node);

  return tree
    .map((node) => {
      if (node.id !== NavID.cfg || !node.children) {
        return node;
      }
      return {
        ...node,
        children: node.children.filter((child) => !isPrunable(PRUNABLE_ADMIN_SECTIONS, child)),
      };
    })
    .filter((node) => !isPrunable(PRUNABLE_SECTIONS, node));
}

/** Nav id of an app plugin's own entry/section (matches the Go builder's ids) */
export const pluginPageId = (pluginId: string) => `plugin-page-${pluginId}`;

/** Nav id of a plugin page rendered standalone inside a core section */
export const standalonePluginPageId = (key: string) => `standalone-plugin-page-${key}`;

/**
 * Standalone nav id derived from a page title, e.g. 'Service Overview' →
 * 'standalone-plugin-page-service-overview'. Deriving an id from display text
 * is fragile, but it is what the Go builder does (applinks.go, where the same
 * lowercase-and-hyphenate runs), and the ids have to match: translations,
 * bookmarks and pins are all keyed by nav id.
 *
 * Text-derived ids lack the leading slash that path-derived ones carry, which
 * is what keeps the page on the regular /a/<pluginId> routing rather than a
 * core URL (see isStandalonePluginPage in app/features/plugins/routes.tsx).
 */
export const standalonePluginPageIdFromText = (text: string) =>
  standalonePluginPageId(text.toLowerCase().replaceAll(' ', '-'));
