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

import { APP_NAV_CONFIG, APP_NAV_PATH_CONFIG, type AppNavConfig } from './appNavConfig';
import { buildStaticNavTree } from './buildStaticNavTree';
import { NavID, NavWeight, PLUGIN_SECTION_SHELLS, pluginPageId, standalonePluginPageId } from './constants';
import { PLUGIN_NAV_OVERRIDES } from './pluginNavOverrides';
import { applyAppSubUrl, findNavById, pruneEmptyNavSections, sortNavTree, updateNavById } from './utils';

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
 * - INI nav overrides ([navigation.app_sections]) are unsupported
 * - assistant includes gated on per-org plugin jsonData (the Investigations
 *   page, trial-mode restrictions) are not reproduced — jsonData is not
 *   readable client-side; the deployment-mode filtering is (see
 *   APP_NAV_CONFIG's filterInclude)
 * - page includes without a path are skipped (the meta spec carries no slug
 *   for the legacy /plugins/<id>/page/<slug> fallback URL)
 */
export function mergePluginNavIntoTree(currentTree: NavModelItem[], apps: AppPluginMetaConfig[]): NavModelItem[] {
  const installedPluginIds: ReadonlySet<string> = new Set(apps.map((app) => app.id));

  // Merge into a freshly built static tree rather than the current slice
  // state: re-merges (e.g. after a remount refetch) into an already-merged
  // tree would otherwise duplicate every plugin item, and a failed fetch may
  // have left the current tree without its attachment shells.
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

  tree = applyAppSubUrl(sortNavTree(pruneEmptyNavSections(tree)));
  return carryOverRuntimeChildren(tree, currentTree);
}

/** A page include placed directly into a core section instead of under its app */
interface StandalonePagePlacement {
  sectionId: string;
  link: NavModelItem;
}

/**
 * Builds the nav items for one app plugin and returns a new tree with them
 * placed: standalone pages go into their configured core sections, and the
 * app link itself (or its hoisted pages) into its section.
 */
function addAppToTree(tree: NavModelItem[], app: AppPluginMetaConfig): NavModelItem[] {
  const { appLink, standalonePlacements } = buildAppLink(app);

  const withStandalonePages = standalonePlacements.reduce(applyStandalonePlacement, tree);

  // Apps without any nav children are not part of the nav tree (their
  // standalone pages, if any, still are)
  if ((appLink.children ?? []).length === 0) {
    return withStandalonePages;
  }

  return placeAppInSection(withStandalonePages, app, withNavConfigOverrides(app, appLink));
}

/** Builds the app's nav link (and any standalone page placements) from its
 * page and dashboard includes */
function buildAppLink(app: AppPluginMetaConfig): {
  appLink: NavModelItem;
  standalonePlacements: StandalonePagePlacement[];
} {
  const standalonePlacements: StandalonePagePlacement[] = [];
  let appUrl = `/a/${app.id}`;
  const children: NavModelItem[] = [];
  const filterInclude = APP_NAV_CONFIG[app.id]?.filterInclude;

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

      const link: NavModelItem = {
        text: include.name,
        icon: toIconName(include.icon),
        pluginId: app.id,
        url: include.path,
      };

      if (include.defaultNav && include.addToNav) {
        appUrl = include.path;
      }

      // Pages whose path is registered in the standalone config render inside
      // a core section (e.g. grafana-auth-app under cfg/access) instead of
      // under their own app entry, regardless of addToNav.
      const pathConfig = APP_NAV_PATH_CONFIG[include.path];
      if (pathConfig) {
        standalonePlacements.push({
          sectionId: pathConfig.sectionId,
          link: {
            ...link,
            id: standalonePluginPageId(include.path),
            sortWeight: pathConfig.sortWeight,
            ...(pathConfig.subTitle && { subTitle: pathConfig.subTitle }),
          },
        });
      } else if (include.addToNav) {
        children.push(link);
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
    standalonePlacements,
  };
}

/** Places a standalone page into its target section, overriding a core page
 * with the same URL rather than duplicating it. Returns a new tree. */
function applyStandalonePlacement(tree: NavModelItem[], { sectionId, link }: StandalonePagePlacement): NavModelItem[] {
  if (!findNavById(tree, sectionId)) {
    return tree;
  }
  return updateNavById(tree, sectionId, (section) => {
    const children = section.children ?? [];
    const overridesCorePage = children.some((child) => child.url === link.url);
    return {
      ...section,
      children: overridesCorePage
        ? children.map((child) =>
            child.url === link.url
              ? { ...child, id: link.id, sortWeight: link.sortWeight, pluginId: link.pluginId, children: [] }
              : child
          )
        : [...children, link],
    };
  });
}

/** Applies the app's APP_NAV_CONFIG display overrides (name, icon, subtitle, badge) */
function withNavConfigOverrides(app: AppPluginMetaConfig, appLink: NavModelItem): NavModelItem {
  const navConfig = APP_NAV_CONFIG[app.id];
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
  const navConfig = APP_NAV_CONFIG[app.id];
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

  const shell = PLUGIN_SECTION_SHELLS[sectionId];
  if (!shell) {
    console.warn('[navtree] plugin app nav id not found', app.id, sectionId);
    return tree;
  }

  // The core alerting section moves inside Alerts & IRM when it is created
  if (sectionId === NavID.alertsAndIncidents) {
    const alerting = tree.find((node) => node.id === NavID.alerting);
    return [
      ...tree.filter((node) => node.id !== NavID.alerting),
      { ...shell, children: [...(alerting ? [{ ...alerting, sortWeight: 2 }] : []), appLink] },
    ];
  }

  if (sectionId === NavID.adaptiveTelemetry) {
    // Icon URL from the first Adaptive Telemetry plugin (they all match)
    return [...tree, { ...shell, children: sectionChildren, img: config.appSubUrl + app.info.logos.large }];
  }

  return [...tree, { ...shell, children: sectionChildren }];
}

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
  return (appLink.children ?? []).map((child) => ({
    ...child,
    sortWeight: (child.url && slotWeightByPath[child.url]) || -100 + (child.sortWeight ?? 0),
    id: standalonePluginPageId((child.text ?? '').toLowerCase().replaceAll(' ', '-')),
  }));
}

/**
 * The starred and bookmarks containers are filled at runtime (stars sync,
 * legacy bookmarks); a freshly built tree has them empty, so their children
 * are copied over from the tree currently in the store. Returns a new tree.
 */
function carryOverRuntimeChildren(tree: NavModelItem[], currentTree: NavModelItem[]): NavModelItem[] {
  return [NavID.starred, NavID.bookmarks].reduce((acc, id) => {
    const current = currentTree.find((node) => node.id === id);
    if (!current?.children?.length) {
      return acc;
    }
    return acc.map((node) => (node.id === id ? { ...node, children: cloneDeep(current.children) } : node));
  }, tree);
}

// An include with an RBAC action is gated on that action (the per-plugin
// scope is not representable client-side); otherwise the legacy role check
// applies: the user's org role must rank at or above the include's role.
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
