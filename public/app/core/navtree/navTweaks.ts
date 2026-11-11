import { type NavModelItem } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { NavID, NavWeight } from './constants';
import { moveNavItemToSection, pluginPageId } from './utils';

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

interface NavTweak {
  when: () => boolean;
  apply: (tree: NavModelItem[]) => NavModelItem[];
}

const NAV_TWEAKS: NavTweak[] = [
  {
    // Temporarily list Machine Learning's pages directly under More apps for the refreshed IA.
    when: isInfoArchRefresh,
    apply: (tree) =>
      moveNavItemToSection(tree, pluginPageId('grafana-ml-app'), NavID.apps, {
        sortWeight: NavWeight.plugin,
        hoistPages: true,
      }),
  },
];

/** Applies independently gated tweaks without letting one failure abort store creation. */
export function applyNavTweaks(tree: NavModelItem[], tweaks: NavTweak[] = NAV_TWEAKS): NavModelItem[] {
  return tweaks.reduce((current, tweak, index) => {
    try {
      return tweak.when() ? tweak.apply(current) : current;
    } catch (error) {
      console.warn('[navtree] nav tweak failed', index, error);
      return current;
    }
  }, tree);
}
