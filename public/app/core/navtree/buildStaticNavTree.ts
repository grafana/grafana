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
 * The client-built nav tree also requires plugins.useMTPlugins: without it the
 * pluginMeta service never fetches metas, so plugin nav would always be
 * missing. (The metas API itself additionally depends on
 * pluginStoreServiceLoading and pluginInstallAPISync server-side; if those are
 * off the fetch fails or returns nothing and the menu falls back to the
 * static-only tree.)
 *
 * Must be kept in sync with the skip condition in pkg/api/index.go
 * (setIndexViewData), which stops building the server tree when this is on.
 */
function isClientNavTreeEnabled(): boolean {
  return (
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantNavTree, false) &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)
  );
}

/**
 * The entry point used by the redux slices: returns the client-built static
 * tree when the flag is on, or the server-provided tree otherwise.
 */
export function getInitialNavTree(): NavModelItem[] {
  if (!isClientNavTreeEnabled()) {
    return config.bootData?.navTree ?? [];
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
