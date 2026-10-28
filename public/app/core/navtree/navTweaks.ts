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
    // Machine Learning goes back under More apps until its place in the new IA
    // is settled, with its pages listed there rather than nested under an app
    // node. NavWeight.plugin is what an app with no placement of its own carries,
    // so the move ties with the other apps instead of bringing its top-level
    // weight along; the hoist then leaves the pages where the plugin pass would
    // have put them had the app's nav config asked for it.
    when: isInfoArchRefresh,
    apply: (tree) => {
      const id = pluginPageId('grafana-ml-app');
      return hoistNavItemPages(moveNavItemToSection(tree, id, NavID.apps, NavWeight.plugin), NavID.apps, id);
    },
  },
];

/**
 * Applies the tweaks to a finished nav tree, whichever side built it.
 *
 * Each runs in its own try/catch: this is called while the redux store is being
 * created, so a throw would cost the whole nav rather than one adjustment. The
 * list is a parameter so tests can exercise that without a real tweak.
 */
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
