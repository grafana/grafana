import { type IconName, type NavModelItem } from '@grafana/data';
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

const isAdminSubNav = () => getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaNavigationAdminSubNav, false);

// Weights below General's own destinations (Stats and license carries -1), so
// these lead it whatever weight they arrived with, in this order
const ADMIN_GENERAL_LEADING = [
  { id: 'org-settings', sortWeight: -30 },
  { id: 'migrate-to-cloud', sortWeight: -20 },
  { id: 'provisioning', sortWeight: -10 },
];

// Weights well above General's own destinations, so the moved items land after
// them whatever weight they arrived with, in this order
const ADMIN_GENERAL_TRAILING = [
  { id: 'authentication', sortWeight: 1000 },
  { id: pluginPageId('grafana-advisor-app'), sortWeight: 1001 },
  { id: 'secrets-management', sortWeight: 1002 },
];

// Icons the section nav's design gives its destinations. Authentication has
// one already and is changed to match, the others only gain one when they lack it
const ADMIN_ICONS: Record<string, { icon: IconName; replace?: boolean }> = {
  'migrate-to-cloud': { icon: 'cloud-upload' },
  provisioning: { icon: 'code-branch' },
  authentication: { icon: 'key-skeleton-alt', replace: true },
  [pluginPageId('grafana-advisor-app')]: { icon: 'heart' },
  'secrets-management': { icon: 'lock' },
};

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
  {
    // With Administration folded to one mega menu row, its destinations are read
    // as groups in the section nav, so the ones that sat ungrouped join General
    // and General's destinations are put in the order the section nav shows.
    // A missing item is left out rather than failing the rest.
    when: isAdminSubNav,
    apply: (tree) => {
      const regrouped = [...ADMIN_GENERAL_LEADING, ...ADMIN_GENERAL_TRAILING].reduce(
        (current, { id, sortWeight }) => moveNavItemToSection(current, id, NavID.cfgGeneral, sortWeight),
        tree
      );
      // Without General nothing was regrouped, so there is nothing to restyle either
      return findNavById(regrouped, NavID.cfgGeneral) ? withAdminIcons(landOnDefaultPreferences(regrouped)) : regrouped;
    },
  },
];

/**
 * Points Administration and General at Default preferences, which the section
 * nav lists first, so neither needs a landing page of its own, and drops General
 * from breadcrumbs for the same reason. Left alone when the user has no Default
 * preferences.
 */
function landOnDefaultPreferences(tree: NavModelItem[]): NavModelItem[] {
  const url = findNavById(tree, 'org-settings')?.url;
  if (!url) {
    return tree;
  }
  const retarget = (nodes: NavModelItem[]): NavModelItem[] =>
    nodes.map((node) => ({
      ...node,
      ...(node.id === NavID.cfg ? { url } : {}),
      ...(node.id === NavID.cfgGeneral ? { url, hideFromBreadcrumbs: true } : {}),
      ...(node.children ? { children: retarget(node.children) } : {}),
    }));
  return retarget(tree);
}

function withAdminIcons(nodes: NavModelItem[]): NavModelItem[] {
  return nodes.map((node) => {
    const wanted = node.id ? ADMIN_ICONS[node.id] : undefined;
    return {
      ...node,
      ...(wanted && (wanted.replace || !node.icon) ? { icon: wanted.icon } : {}),
      ...(node.children ? { children: withAdminIcons(node.children) } : {}),
    };
  });
}

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
