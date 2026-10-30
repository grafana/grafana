import { type NavModelItem, userHasAnyPermission } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';

import { HOISTED_PAGE_WEIGHT_OFFSET, NavID, type NavId } from './constants';

/** Whether to build the nav tree client-side, covering the static sections only. */
export function isClientNavTreeEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantNavTree, false);
}

/** Whether app plugin nav items are fetched and folded in, on top of the client build. */
function arePluginNavItemsEnabled(): boolean {
  return isClientNavTreeEnabled() && getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false);
}

/**
 * Whether the app metas are there to be read. The metas endpoint needs a session,
 * so app.ts skips the fetch without one — and the tree must not then read a cache
 * nobody filled. Both sites go through this, so they cannot drift apart.
 */
export function isPluginNavAvailable(): boolean {
  return arePluginNavItemsEnabled() && contextSrv.user.orgRole !== '';
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
//
// "More apps" is created on demand, so it is only ever empty when an override
// has moved its last app elsewhere (maintenance windows, under SLO).
const PRUNABLE_SECTIONS: NavId[] = [NavID.cfg, NavID.connections, NavID.drilldown, NavID.apps];

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
 * Depth-first search of a nav tree by item url; `match` sees each url as the tree stores it (app sub url
 * included), so a caller decides what counts as the same destination (exact, by path, ...).
 */
export function findNavByUrl(nodes: NavModelItem[], match: (url: string) => boolean): NavModelItem | undefined {
  for (const node of nodes) {
    if (node.url !== undefined && match(node.url)) {
      return node;
    }
    const found = node.children && findNavByUrl(node.children, match);
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
    url: withAppSubUrl(node.url),
    children: node.children ? applyAppSubUrl(node.children) : node.children,
  }));
}

/**
 * Prefixes a root-relative path with the app sub url. Absolute urls (plugin
 * assets served from a CDN) and relative ones (which the index page's
 * `<base href>` already resolves) are left alone.
 */
export function withAppSubUrl(path: string | undefined): string | undefined {
  return path?.startsWith('/') ? `${config.appSubUrl}${path}` : path;
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

/** Moves an item by id into a section, optionally resetting its weight, then re-sorts the section. */
export function moveNavItemToSection(
  tree: NavModelItem[],
  id: string,
  sectionId: string,
  sortWeight?: number
): NavModelItem[] {
  const item = findNavById(tree, id);
  if (!item || !findNavById(tree, sectionId)) {
    return tree;
  }

  const moved = { ...item, ...(sortWeight !== undefined && { sortWeight }) };
  const placed = appendIntoSection(removeNavById(tree, id), sectionId, [moved]);
  if (!placed) {
    return tree;
  }

  return updateNavById(placed, sectionId, (section) => ({
    ...section,
    children: sortNavTree(section.children ?? []),
  }));
}

/**
 * Returns an app's pages as standalone entries with section weights. Only app URLs get standalone
 * ids, so dashboard includes keep their own routes.
 */
export function hoistAppPages(
  appLink: NavModelItem,
  { slotWeightByPath = {} }: { slotWeightByPath?: Record<string, number> } = {}
): NavModelItem[] {
  const appPrefix = `/a/${appLink.pluginId}`;

  return (appLink.children ?? []).map((child) => {
    // This runs during store creation, before locationUtil is initialized.
    const appSubUrl = config.appSubUrl.replace(/\/+$/, '');
    const url = appSubUrl && child.url?.startsWith(`${appSubUrl}/`) ? child.url.slice(appSubUrl.length) : child.url;
    const slotWeight = url ? slotWeightByPath[url] : undefined;
    return {
      ...child,
      sortWeight: slotWeight ?? HOISTED_PAGE_WEIGHT_OFFSET + (child.sortWeight ?? 0),
      ...(url?.startsWith(appPrefix) && { id: hoistedPluginPageId(url) }),
    };
  });
}

/**
 * Replaces an app's node inside a section with its hoisted pages, for callers
 * working on a finished tree — where the plugin pass that would have hoisted them
 * has already run. Returns the tree untouched if the app, the section, or the
 * app's pages are missing.
 */
export function hoistNavItemPages(tree: NavModelItem[], sectionId: string, id: string): NavModelItem[] {
  const section = findNavById(tree, sectionId);
  const item = section?.children?.find((child) => child.id === id);
  if (!section || !item?.children?.length) {
    return tree;
  }

  const hoisted = hoistAppPages(item);

  return updateNavById(tree, sectionId, (node) => ({
    ...node,
    children: sortNavTree([...(node.children ?? []).filter((child) => child !== item), ...hoisted]),
  }));
}

/** Nav id of an app plugin's own entry/section (matches the Go builder's ids) */
export const pluginPageId = (pluginId: string) => `plugin-page-${pluginId}`;

/** Nav id of a plugin page rendered standalone inside a core section */
export const standalonePluginPageId = (key: string) => `standalone-plugin-page-${key}`;

/**
 * Nav id of a page hoisted out of its app. The path is flattened rather than
 * used as-is: an id beginning `standalone-plugin-page-/` tells
 * app/features/plugins/routes.tsx to route that page by its own url alone, and
 * a hoisted app needs its app-wide route, since it has no node left to carry it.
 */
export const hoistedPluginPageId = (includePath: string) =>
  standalonePluginPageId(includePath.replace(/^\//, '').replaceAll('/', '-'));
