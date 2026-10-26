import { type NavModelItem } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { NavID, NavWeight } from './constants';
import { appendIntoSection, findNavById, pluginPageId, removeNavById, sortNavTree, updateNavById } from './utils';

/**
 * Transitional nav adjustments, all of them meant to be deleted. Everything here
 * is gated on grafana.navigationInfoArchRefresh and is expected to go with it,
 * so keep each entry's reason for existing next to it.
 *
 * Two kinds, and the difference matters:
 *
 * - NAV_TWEAKS change the tree itself, so routing, breadcrumbs, the command
 *   palette and the menu all see the result. Applied to both the client-built
 *   and the server-built tree, which is also why a tweak here needs no backend
 *   change.
 * - HIDDEN_NAV_ITEMS only change what the mega menu draws. A hidden page still
 *   routes and still answers the command palette, which is what a transitional
 *   hide should do.
 *
 * Permanent structure belongs elsewhere: app placement in APP_NAV_CONFIG, the
 * cross-plugin adjustments the server also makes in PLUGIN_NAV_OVERRIDES.
 */
export interface NavTweak {
  /** Why this exists and what retires it */
  description: string;
  apply: (tree: NavModelItem[]) => NavModelItem[];
  /** Narrows further than the flag, where a tweak needs it */
  when?: () => boolean;
}

const NAV_TWEAKS: NavTweak[] = [
  {
    description: 'Machine Learning goes back under More apps until its place in the new IA is settled',
    // NavWeight.plugin is what an app with no placement of its own carries, so it
    // ties with the other apps and keeps their order. Without it the app would
    // bring its top-level weight along and sort above everything in the section.
    apply: (tree) => moveNavItemToSection(tree, pluginPageId('grafana-ml-app'), NavID.apps, NavWeight.plugin),
  },
];

/**
 * Items the mega menu leaves out, for everyone, pins and customisation included.
 * Key on the nav id ('explore', 'dashboards/playlists', 'plugin-page-my-app'),
 * or on the nav url without the app sub url for an item that has no id — the
 * prefix is added when matching. Hiding a parent hides its descendants.
 */
export const HIDDEN_NAV_ITEMS = new Set<string>([
  '/a/grafana-adaptive-metrics-app/configuration',
  '/a/grafana-adaptive-metrics-app/rule-management',
  '/a/grafana-adaptive-metrics-app/segments',

  '/a/grafana-adaptivelogs-app/drop-rules',
  '/a/grafana-adaptivelogs-app/segments',
  '/a/grafana-adaptivelogs-app/patterns',
  '/a/grafana-adaptivelogs-app/exemptions',

  '/a/grafana-adaptivetraces-app/policies',

  '/a/grafana-cmab-app/usage',
  '/a/grafana-cmab-app/cardinality',
  '/a/grafana-cmab-app/attributions',
  '/a/grafana-cmab-app/usage-alerts',
  '/a/grafana-cmab-app/invoices',
  '/a/grafana-cmab-app/settings',
  '/a/grafana-cmab-app/resources',
]);

/**
 * Applies the tweaks above to a finished nav tree, whichever side built it.
 *
 * Each runs in its own try/catch: this is called while the redux store is being
 * created, so a throw would cost the whole nav rather than one adjustment. The
 * list is a parameter so tests can exercise that without a real tweak.
 */
export function applyNavTweaks(tree: NavModelItem[], tweaks: NavTweak[] = NAV_TWEAKS): NavModelItem[] {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNavigationInfoArchRefresh, false)) {
    return tree;
  }

  return tweaks.reduce((current, tweak) => {
    try {
      return tweak.when && !tweak.when() ? current : tweak.apply(current);
    } catch (error) {
      console.warn('[navtree] nav tweak failed', tweak.description, error);
      return current;
    }
  }, tree);
}

/**
 * Moves an item into another section, by nav id. Ids are the only safe key here:
 * the server-built tree arrives with the app sub url already applied to every
 * url, so a url match would hold for one tree and not the other.
 *
 * The item is appended and the destination re-sorted, since this runs after the
 * tree is already in order. It keeps its own sortWeight unless given one, which
 * is rarely what you want when moving between levels — a weight that positioned
 * an item at the top level outranks everything inside a section. Returns the
 * tree untouched if either end is missing.
 */
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
