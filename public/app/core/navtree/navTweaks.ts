import { type NavModelItem } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { type NavId, NavID, NavWeight, PLUGIN_SECTION_SHELLS } from './constants';
import { type PluginNavOverride } from './pluginNavOverrides';
import { findNavById, hoistNavItemPages, moveNavItemToSection, pluginPageId, withAppSubUrl } from './utils';

/**
 * Transitional nav adjustments, every one of them meant to be deleted. Each
 * carries its own gate, so they need not share a flag or go at the same time.
 *
 * Permanent structure belongs elsewhere: app placement in APP_NAV_CONFIG, and
 * the cross-plugin adjustments the server makes too in PLUGIN_NAV_OVERRIDES.
 * Hiding an item from the menu alone belongs in HIDDEN_NAV_ITEMS.
 */
const isInfoArchRefresh = () =>
  getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNavigationInfoArchRefresh, false);

// PluginNavOverride's shape, minus its plugin sets: these run on a finished
// tree, where the apps that built it are no longer around to ask about
type NavTweak = Pick<PluginNavOverride, 'when' | 'apply'>;

const NAV_TWEAKS: NavTweak[] = [
  {
    // Temporarily list Machine Learning's pages directly under More apps for the refreshed IA.
    when: isInfoArchRefresh,
    apply: (tree) => {
      const id = pluginPageId('grafana-ml-app');
      // Checked before the section is created, so an instance without the app
      // does not gain an empty More apps
      if (!findNavById(tree, id)) {
        return tree;
      }
      const withSection = ensureSection(tree, NavID.apps);
      return hoistNavItemPages(moveNavItemToSection(withSection, id, NavID.apps, NavWeight.plugin), NavID.apps, id);
    },
  },
];

/**
 * Adds a section's shell when the tree has none. Tweaks run on a finished tree,
 * after empty shells are pruned, so a section whose only members these tweaks
 * are about to move in is absent by then.
 */
function ensureSection(tree: NavModelItem[], sectionId: NavId): NavModelItem[] {
  if (findNavById(tree, sectionId)) {
    return tree;
  }
  const shell = PLUGIN_SECTION_SHELLS[sectionId]?.shell;
  if (!shell) {
    return tree;
  }
  // Inserted at its sorted position rather than appended and re-sorted: the
  // tree is already sorted, and sortNavTree numbers unweighted items by index,
  // so a second pass over new indices would not agree with the first
  const weightOf = (node: NavModelItem, index: number) => node.sortWeight || index + 1;
  const found = tree.findIndex((node, index) => weightOf(node, index) > (shell.sortWeight ?? 0));
  const at = found === -1 ? tree.length : found;
  // The shells are declared sub-url agnostic, and applyAppSubUrl has already run
  // by the time the tweaks do — on both trees — so this one is prefixed here
  return [...tree.slice(0, at), { ...shell, url: withAppSubUrl(shell.url), children: [] }, ...tree.slice(at)];
}

/** Applies independently gated tweaks without letting one failure abort store creation. */
export function applyNavTweaks(tree: NavModelItem[], tweaks: NavTweak[] = NAV_TWEAKS): NavModelItem[] {
  return tweaks.reduce((current, tweak, index) => {
    try {
      return tweak.when(current, new Set()) ? tweak.apply(current, new Set()) : current;
    } catch (error) {
      console.warn('[navtree] nav tweak failed', index, error);
      return current;
    }
  }, tree);
}
