import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { dashboardsNavEntry } from './sections/dashboards.navEntry';
import { getHomeNode } from './sections/home.navEntry';
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
 * Known gap (fix parked): app.ts skips OpenFeature init for signed-out and
 * anonymous sessions, so the flag reads false there and getInitialNavTree falls
 * back to the bootdata tree. Those sessions need the decision passed at boot
 * time rather than re-evaluated here.
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
    return config.bootData?.navTree ?? [];
  }

  const staticTree = applyAppSubUrl(buildStaticNavTree());
  // Empty attachment-parent sections are pruned like the server prunes them
  // after its enterprise hooks run.
  return pruneEmptyNavSections(staticTree);
}

/**
 * The static sections of the nav tree: each entry declares the gate that makes
 * it visible and how to build it. Home is not listed — it is unconditional and
 * seeds the tree. The entries are defined in ./sections; this module only
 * composes them.
 */
const STATIC_NAV_ENTRIES: NavEntryBuilder[] = [dashboardsNavEntry];

/**
 * Builds the static (non-plugin) portion of the nav tree, sorted, with urls
 * app-sub-url relative: callers apply the prefix once via applyAppSubUrl at
 * the end of their pipeline.
 */
export function buildStaticNavTree(): NavModelItem[] {
  return sortNavTree([getHomeNode(), ...buildEntries(STATIC_NAV_ENTRIES)]);
}
