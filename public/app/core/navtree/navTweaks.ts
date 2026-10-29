import { type NavModelItem } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { NavID, NavWeight } from './constants';
import { type PluginNavOverride } from './pluginNavOverrides';
import { hoistNavItemPages, moveNavItemToSection, pluginPageId } from './utils';

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
      return hoistNavItemPages(moveNavItemToSection(tree, id, NavID.apps, NavWeight.plugin), NavID.apps, id);
    },
  },
];

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
