import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingNavEntry } from 'app/features/alerting/unified/navigation/alerting.navEntry';

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
  appendIntoSection,
  applyAppSubUrl,
  buildEntries,
  isClientNavTreeEnabled,
  type NavEntryBuilder,
  sortNavTree,
} from './utils';

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

  // The empty connections and cfg shells stay: the plugin merge attaches to
  // them, and prunes whatever is still empty once it completes.
  return applyAppSubUrl(buildStaticNavTree());
}

/**
 * The static sections of the nav tree: each entry declares the gate that makes
 * it visible and how to build it. Home is not listed — it is unconditional and
 * seeds the tree. The entries are defined in ./sections; this module only
 * composes them.
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
    const next = appendIntoSection(current, parentId, built);
    if (!next) {
      // A registered item naming a section that isn't there is a bug in the
      // registering bundle, so say so rather than dropping it silently
      console.warn('[navtree] registered nav entry parent not found', parentId);
      return current;
    }
    return next;
  }, tree);
}
