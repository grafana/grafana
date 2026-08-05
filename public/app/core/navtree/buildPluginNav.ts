import { cloneDeep, isUndefined, omitBy } from 'lodash';

import {
  type AppPluginMetaConfig,
  isIconName,
  type NavModelItem,
  type PluginInclude,
  PluginIncludeType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { appNavConfigFor, type AppNavConfig } from './appNavConfig';
import { buildStaticNavTree } from './buildStaticNavTree';
import { NavID, NavWeight, PLUGIN_SECTION_SHELLS } from './constants';
import { PLUGIN_NAV_OVERRIDES } from './pluginNavOverrides';
import {
  applyAppSubUrl,
  findNavById,
  pluginPageId,
  pruneEmptyNavSections,
  sortNavTree,
  standalonePluginPageIdFromText,
  updateNavById,
} from './utils';

const ORG_ROLE_RANK: Record<string, number> = { None: 0, Viewer: 1, Editor: 2, Admin: 3 };

/**
 * Merges app-plugin nav items, fetched from the plugins.grafana.app metas API
 * via the grafana-runtime pluginMeta service, into the client-built nav tree.
 * Returns a new tree; the input is not mutated. (While the server builder
 * still exists, the equivalent Go logic is addAppLinks in
 * pkg/services/navtree/navtreeimpl/applinks.go — kept behaviourally in sync.)
 *
 * Known divergences from the server-built tree, accepted for the client-side
 * build:
 * - per-org plugin enablement is not checked (presence in the namespace
 *   counts as enabled)
 * - the plugins.app:access permission is evaluated without its per-plugin
 *   scope
 * - INI standalone-page overrides ([navigation.app_standalone_pages]) are
 *   unsupported ([navigation.app_sections] is: delivered via frontend
 *   settings, applied by appNavConfigFor)
 * - assistant includes gated on per-org plugin jsonData (the Investigations
 *   page, trial-mode restrictions) are not reproduced — jsonData is not
 *   readable client-side; the deployment-mode filtering is (see
 *   APP_NAV_CONFIG's filterInclude)
 * - page includes without a path are skipped (the meta spec carries no slug
 *   for the legacy /plugins/<id>/page/<slug> fallback URL)
 */
export function mergePluginNavIntoTree(apps: AppPluginMetaConfig[]): NavModelItem[] {
  const installedPluginIds: ReadonlySet<string> = new Set(apps.map((app) => app.id));

  // Merge into a freshly built static tree rather than the current slice
  // state: re-merges (e.g. after a remount refetch) into an already-merged
  // tree would otherwise duplicate every plugin item, and a failed fetch may
  // have left the current tree without its attachment shells. Runtime-filled
  // containers (starred, bookmarks) are the dispatcher's concern — see
  // carryOverRuntimeChildren.
  let tree = buildStaticNavTree();

  if (contextSrv.hasPermission(AccessControlAction.PluginsAppAccess)) {
    for (const app of apps) {
      try {
        tree = addAppToTree(tree, app);
      } catch (error) {
        console.warn('[navtree] failed to build nav for app plugin', app.id, error);
      }
    }
  }

  for (const override of PLUGIN_NAV_OVERRIDES) {
    if (override.when(tree, installedPluginIds)) {
      tree = override.apply(tree, installedPluginIds);
    }
  }

  return applyAppSubUrl(sortNavTree(pruneEmptyNavSections(tree)));
}

/**
 * Builds the nav items for one app plugin and returns a new tree with the app
 * link (or its hoisted pages) placed into its section.
 */
function addAppToTree(tree: NavModelItem[], app: AppPluginMetaConfig): NavModelItem[] {
  const { appLink, hasAccessiblePages } = buildAppLink(app);

  // A `singlePage` app's only page folds into the app link itself, leaving it
  // childless; it is still placed (as a leaf) as long as the page passed its
  // access checks. Any other childless app is not part of the nav tree.
  const placeAsLeaf = Boolean(appNavConfigFor(app.id)?.singlePage) && hasAccessiblePages;
  if ((appLink.children ?? []).length === 0 && !placeAsLeaf) {
    return tree;
  }

  const link = placeAsLeaf ? { ...appLink, isSection: false } : appLink;
  return placeAppInSection(tree, app, withNavConfigOverrides(app, link));
}

/** Builds the app's nav link from its page and dashboard includes */
function buildAppLink(app: AppPluginMetaConfig): { appLink: NavModelItem; hasAccessiblePages: boolean } {
  let appUrl = `/a/${app.id}`;
  let hasAccessiblePages = false;
  const children: NavModelItem[] = [];
  const filterInclude = appNavConfigFor(app.id)?.filterInclude;

  for (const include of app.includes) {
    if (!hasAccessToInclude(include) || (filterInclude && !filterInclude(include))) {
      continue;
    }

    if (include.type === PluginIncludeType.page) {
      // Pathless page includes are component pages; without the legacy slug
      // there is no URL to link to.
      if (!include.path) {
        continue;
      }
      hasAccessiblePages = true;

      if (include.defaultNav && include.addToNav) {
        appUrl = include.path;
      }

      if (include.addToNav) {
        children.push({
          text: include.name,
          icon: toIconName(include.icon),
          pluginId: app.id,
          url: include.path,
        });
      }
    }

    if (include.type === PluginIncludeType.dashboard && include.addToNav && include.uid) {
      children.push({
        url: `/d/${include.uid}`,
        text: include.name,
        pluginId: app.id,
      });
    }
  }

  return {
    appLink: {
      text: app.name,
      id: pluginPageId(app.id),
      img: app.info.logos.small,
      subTitle: app.info.description,
      sortWeight: NavWeight.plugin,
      isSection: true,
      pluginId: app.id,
      url: appUrl,
      // Children matching the app default nav are folded into the app link itself
      children: children.filter((child) => child.url !== appUrl),
    },
    hasAccessiblePages,
  };
}

/** Applies the app's APP_NAV_CONFIG display overrides (name, icon, subtitle, badge) */
function withNavConfigOverrides(app: AppPluginMetaConfig, appLink: NavModelItem): NavModelItem {
  const navConfig = appNavConfigFor(app.id);
  if (!navConfig) {
    return appLink;
  }
  const { sortWeight, text, subTitle, isNew, icon } = navConfig;
  return {
    ...appLink,
    sortWeight,
    // Absent overrides must not clobber the plugin's own values with undefined
    ...omitBy({ text, subTitle, isNew }, isUndefined),
    ...(icon && { icon: toIconName(icon) }),
  };
}

/**
 * Places the app link into its configured section (default "More apps"),
 * creating the section from its shell if this is the first app targeting it.
 * Returns a new tree.
 */
function placeAppInSection(tree: NavModelItem[], app: AppPluginMetaConfig, appLink: NavModelItem): NavModelItem[] {
  const navConfig = appNavConfigFor(app.id);
  const sectionId = navConfig?.sectionId ?? NavID.apps;

  if (sectionId === NavID.root) {
    return [...tree, appLink];
  }

  const sectionChildren = navConfig?.hoistPages ? hoistAppPages(appLink, navConfig.hoistPages) : [appLink];

  if (findNavById(tree, sectionId)) {
    return updateNavById(tree, sectionId, (section) => ({
      ...section,
      children: [...(section.children ?? []), ...sectionChildren],
    }));
  }

  const shellConfig = PLUGIN_SECTION_SHELLS[sectionId];
  if (!shellConfig) {
    console.warn('[navtree] plugin app nav id not found', app.id, sectionId);
    return tree;
  }
  const { shell, absorbs = [], imgFromAppLogo } = shellConfig;

  // Core sections the shell absorbs (e.g. Alerting into Alerts & IRM) move
  // from the top level into the new section, at their configured weight
  const absorbed = absorbs
    .map(({ id, sortWeight }) => {
      const node = tree.find((candidate) => candidate.id === id);
      return node && { ...node, sortWeight };
    })
    .filter((node) => node !== undefined);
  const absorbedIds = new Set(absorbed.map((node) => node.id));

  return [
    ...tree.filter((node) => !absorbedIds.has(node.id)),
    {
      ...shell,
      children: [...absorbed, ...sectionChildren],
      ...(imgFromAppLogo && { img: config.appSubUrl + app.info.logos.large }),
    },
  ];
}

// Hoisted pages without a pinned slot sort above the section's app entries
// (which sit at small positive weights) while keeping their own relative order
const HOISTED_PAGE_WEIGHT_OFFSET = -100;

/**
 * Expands an app's pages into its target section as standalone entries instead
 * of nesting them under an app node (`hoistPages` in the app's nav config).
 * Pages pinned by `slotWeightByPath` take that section slot; the rest sort
 * above the section's app entries in their own order.
 */
function hoistAppPages(
  appLink: NavModelItem,
  { slotWeightByPath = {} }: NonNullable<AppNavConfig['hoistPages']>
): NavModelItem[] {
  return (appLink.children ?? []).map((child) => {
    const slotWeight = child.url ? slotWeightByPath[child.url] : undefined;
    return {
      ...child,
      sortWeight: slotWeight ?? HOISTED_PAGE_WEIGHT_OFFSET + (child.sortWeight ?? 0),
      id: standalonePluginPageIdFromText(child.text ?? ''),
    };
  });
}

/**
 * The starred and bookmarks containers are filled at runtime (stars sync,
 * legacy bookmarks); a freshly built tree has them empty, so their children
 * are copied over from the tree currently in the store. Applied by the
 * dispatcher (useNavTree) so mergePluginNavIntoTree stays a pure function of
 * the plugin metas. Returns a new tree.
 */
export function carryOverRuntimeChildren(tree: NavModelItem[], currentTree: NavModelItem[]): NavModelItem[] {
  return [NavID.starred, NavID.bookmarks].reduce((acc, id) => {
    const current = currentTree.find((node) => node.id === id);
    if (!current?.children?.length) {
      return acc;
    }
    return acc.map((node) => (node.id === id ? { ...node, children: cloneDeep(current.children) } : node));
  }, tree);
}

// An include with an RBAC action is gated on that action. The action's
// per-plugin scope (plugins:id:*) is not representable client-side — the
// frontend permissions map flattens scopes away, and evaluating it would take
// a server round-trip per plugin (an /api/access-control check today, an
// apiserver access review once plugin access moves there). Otherwise the
// legacy role check applies: the user's org role must rank at or above the
// include's role.
function hasAccessToInclude(include: PluginInclude): boolean {
  if (include.action) {
    return contextSrv.hasPermission(include.action);
  }
  const requiredRank = ORG_ROLE_RANK[include.role ?? 'Viewer'] ?? ORG_ROLE_RANK.Viewer;
  const userRank = ORG_ROLE_RANK[contextSrv.user.orgRole ?? ''] ?? 0;
  return userRank >= requiredRank;
}

function toIconName(icon: string | undefined): NavModelItem['icon'] {
  return isIconName(icon) ? icon : undefined;
}
