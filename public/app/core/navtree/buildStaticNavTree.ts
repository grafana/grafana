import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { alertingNavEntry } from 'app/features/alerting/unified/navigation/alerting.navEntry';

import { NavID } from './constants';
import { getRegisteredNavEntries } from './registry';
import { adminNavEntry } from './sections/admin.navEntry';
import { connectionsNavEntry } from './sections/connections.navEntry';
import { dashboardsNavEntry } from './sections/dashboards.navEntry';
import { drilldownNavEntry, exploreNavEntry } from './sections/explore.navEntry';
import { helpNavEntry } from './sections/help.navEntry';
import { getHomeNode } from './sections/home.navEntry';
import { notebooksNavEntry } from './sections/notebooks.navEntry';
import { profileNavEntry } from './sections/profile.navEntry';
import { bookmarksNavEntry, starredNavEntry } from './sections/savedItems.navEntry';
import {
  applyAppSubUrl,
  buildEntries,
  findNavById,
  type NavEntryBuilder,
  pruneEmptyNavSections,
  sortNavTree,
  updateNavById,
} from './utils';

/**
 * Whether to build the nav tree client-side. Gated on grafana.multiTenantNavTree
 * alone: this builds only the static sections, which need no plugin data. App
 * plugin nav is folded in by a later PR, gated separately on plugins.useMTPlugins
 * (the metas API it depends on additionally needs pluginStoreServiceLoading and
 * pluginInstallAPISync server-side).
 *
 * The backend (setIndexViewData in pkg/api/index.go) only stops building the
 * server tree once plugins.useMTPlugins is also on, so bootData keeps carrying a
 * server-built tree as a fallback throughout the static-only phase.
 *
 * Known gap (fix parked): nothing guarantees the client reaches the same
 * verdict the server did. app.ts skips OpenFeature init for signed-out and
 * anonymous sessions, and for signed-in sessions a failed or slow OFREP fetch
 * resolves against NOOP_PROVIDER, which silently returns the `false` default.
 * getInitialNavTree then falls back to the bootdata tree. During the
 * static-only phase that tree is a real server-built one (harmless), but once
 * plugins.useMTPlugins is also on the server stops building it and ships an
 * empty tree — then the menu is empty AND navIndex is {}, making every <Page>
 * render a not-found header. The fix is to have the server publish its
 * decision at boot time (a bootdata boolean alongside the tree) and key off
 * that, rather than re-evaluating the flag here.
 */
function isClientNavTreeEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantNavTree, false);
}

/**
 * The entry point used by the redux slices: returns the client-built static
 * tree when the flag is on, or the server-provided tree otherwise.
 */
export function getInitialNavTree(): NavModelItem[] {
  if (!isClientNavTreeEnabled()) {
    // Clone so callers get an owned tree: the flag-off path returns the shared
    // bootData reference, which the redux slices would otherwise mutate. The
    // flag-on path below already returns freshly built objects.
    return cloneDeep(config.bootData?.navTree ?? []);
  }

  const staticTree = applyAppSubUrl(buildStaticNavTree());
  // Empty sections (connections, cfg/access without children) are pruned like
  // the server prunes them after its enterprise hooks run.
  return pruneEmptyNavSections(staticTree);
}

/**
 * The static sections of the nav tree: each entry declares the gate that makes
 * it visible and how to build it. Home is not listed — it is unconditional and
 * seeds the tree. The entries are defined in ./sections (and by the owning
 * feature, e.g. alerting); this module only composes them.
 */
const STATIC_NAV_ENTRIES: NavEntryBuilder[] = [
  starredNavEntry,
  dashboardsNavEntry,
  exploreNavEntry,
  drilldownNavEntry,
  notebooksNavEntry,
  profileNavEntry,
  alertingNavEntry,
  connectionsNavEntry,
  adminNavEntry,
  helpNavEntry,
  bookmarksNavEntry,
];

/**
 * Builds the static (non-plugin) portion of the nav tree, sorted, with urls
 * app-sub-url relative: callers apply the prefix once via applyAppSubUrl at
 * the end of their pipeline. Nav items registered via addNavEntries (e.g. by
 * the enterprise bundle) are appended into their target sections.
 */
export function buildStaticNavTree(): NavModelItem[] {
  const tree = [getHomeNode(), ...buildEntries(STATIC_NAV_ENTRIES)];
  return sortNavTree(applyRegisteredNavEntries(tree));
}

/** Appends registered extension items into their parent sections. Returns a new tree. */
function applyRegisteredNavEntries(tree: NavModelItem[]): NavModelItem[] {
  return getRegisteredNavEntries().reduce((current, { parentId, entry }) => {
    const built = buildEntries([entry]);
    if (built.length === 0) {
      return current;
    }
    if (parentId === NavID.root) {
      return [...current, ...built];
    }
    if (!findNavById(current, parentId)) {
      console.warn('[navtree] registered nav entry parent not found', parentId);
      return current;
    }
    return updateNavById(current, parentId, (parent) => ({
      ...parent,
      children: [...(parent.children ?? []), ...built],
    }));
  }, tree);
}
