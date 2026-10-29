import { cloneDeep } from 'lodash';

import { type AppPluginConfig, type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getAppPluginMetasSync } from '@grafana/runtime/internal';
import { alertingNavEntry } from 'app/features/alerting/unified/navigation/alerting.navEntry';

import { applyPluginNav } from './buildPluginNav';
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
  isPluginNavAvailable,
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
 * metas can be read synchronously here, and this is the only place that reads
 * them: everything below takes the apps as a parameter.
 *
 * Prune after buildNavTree has sorted, not before: pruning first removes
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

  return applyAppSubUrl(pruneEmptyNavSections(buildNavTree(isPluginNavAvailable() ? getAppPluginMetasSync() : [])));
}

/**
 * The static sections of the nav tree: each entry declares the gate that makes
 * it visible and how to build it. Home is not listed — it is unconditional and
 * seeds the tree. The entries are defined in ./sections; this module only
 * composes them. App plugin items are folded in afterwards, by applyPluginNav.
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
  adminNavEntry,
  helpNavEntry,
  bookmarksNavEntry,
];

/**
 * Builds the nav tree, sorted, with urls app-sub-url relative: callers apply
 * the prefix once via applyAppSubUrl at the end of their pipeline. Empty
 * attachment shells are left in place for getInitialNavTree to prune.
 *
 * The plugin pass runs in the middle: after the static sections and the
 * registered entries, because apps are placed into sections those own, and
 * before the sort, because the weights it sets only take effect there.
 */
export function buildNavTree(apps: AppPluginConfig[] = []): NavModelItem[] {
  const sections = applyRegisteredNavEntries([getHomeNode(), ...buildEntries(NAV_ENTRIES)]);
  return sortNavTree(applyPluginNav(sections, apps));
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
