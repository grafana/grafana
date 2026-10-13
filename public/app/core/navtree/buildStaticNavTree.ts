import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingNavEntry } from 'app/features/alerting/unified/navigation/alerting.navEntry';

import { appsNavEntry } from './buildPluginNav';
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
  pruneEmptyNavSections,
  sortNavTree,
} from './utils';

/**
 * The entry point used by the redux slices: returns the client-built tree when
 * the flag is on, or the server-provided tree otherwise.
 *
 * This runs during configureStore, which app.ts calls only after it has awaited
 * both the app plugin metas and the user's permissions — the app plugin section
 * needs the first, and the permission gates need the second. That is why the
 * metas can be read synchronously further down.
 *
 * Prune after buildStaticNavTree has sorted, not before: pruning first removes
 * siblings, and the index fallback in sortNavTree would then number the
 * remaining unweighted ones differently. applyAppSubUrl goes last of all, and
 * runs exactly once over the finished tree.
 */
export function getInitialNavTree(): NavModelItem[] {
  if (!isClientNavTreeEnabled()) {
    // Clone so callers get an owned tree: the flag-off path returns the shared
    // bootData reference, which the redux slices would otherwise mutate. The
    // flag-on path below already returns freshly built objects.
    return cloneDeep(config.bootData?.navTree ?? []);
  }

  return applyAppSubUrl(pruneEmptyNavSections(buildStaticNavTree()));
}

/**
 * Every section of the nav tree: each entry declares the gate that makes it
 * visible and how to build it. Home is not listed — it is unconditional and
 * seeds the tree. The entries live in ./sections, except the app plugin section
 * in ./buildPluginNav; this module only composes them.
 */
const NAV_ENTRIES: NavEntryBuilder[] = [
  starredNavEntry,
  dashboardsNavEntry,
  exploreNavEntry,
  drilldownNavEntry,
  notebooksNavEntry,
  profileNavEntry,
  alertingNavEntry,
  connectionsNavEntry,
  appsNavEntry,
  adminNavEntry,
  helpNavEntry,
  bookmarksNavEntry,
];

/**
 * Builds the nav tree, sorted, with urls app-sub-url relative: callers apply
 * the prefix once via applyAppSubUrl at the end of their pipeline. Nav items
 * registered via addNavEntries (e.g. by the enterprise bundle) are appended
 * into their target sections before the sort. Attachment shells that ended up
 * empty are left in place for getInitialNavTree to prune.
 */
export function buildStaticNavTree(): NavModelItem[] {
  const tree = [getHomeNode(), ...buildEntries(NAV_ENTRIES)];
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
