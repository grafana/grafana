import { cloneDeep } from 'lodash';

import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { adminNavEntry } from './sections/admin.navEntry';
import { dashboardsNavEntry } from './sections/dashboards.navEntry';
import { helpNavEntry } from './sections/help.navEntry';
import { getHomeNode } from './sections/home.navEntry';
import { profileNavEntry } from './sections/profile.navEntry';
import { bookmarksNavEntry, starredNavEntry } from './sections/savedItems.navEntry';
import { applyAppSubUrl, buildEntries, type NavEntryBuilder, pruneEmptyNavSections, sortNavTree } from './utils';

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
  // Empty sections (cfg/access without children) are pruned like the server
  // prunes them after its enterprise hooks run.
  return pruneEmptyNavSections(staticTree);
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
  profileNavEntry,
  adminNavEntry,
  helpNavEntry,
  bookmarksNavEntry,
];

/**
 * Builds the static (non-plugin) portion of the nav tree, sorted, with urls
 * app-sub-url relative: callers apply the prefix once via applyAppSubUrl at
 * the end of their pipeline.
 */
export function buildStaticNavTree(): NavModelItem[] {
  return sortNavTree([getHomeNode(), ...buildEntries(STATIC_NAV_ENTRIES)]);
}
