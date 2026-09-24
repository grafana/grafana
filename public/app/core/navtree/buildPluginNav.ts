import { cloneDeep, isUndefined, omitBy } from 'lodash';

import {
  type AppPluginConfig,
  isIconName,
  type NavModelItem,
  type PluginInclude,
  PluginIncludeType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { appNavConfigFor, type AppNavConfig } from './appNavConfig';
import { NavID, NavWeight, PLUGIN_SECTION_SHELLS } from './constants';
import { PLUGIN_NAV_OVERRIDES } from './pluginNavOverrides';
import {
  appendIntoSection,
  pluginPageId,
  pruneEmptyNavSections,
  sortNavTree,
  standalonePluginPageIdFromText,
} from './utils';

/**
 * Merges app-plugin nav items into a static nav tree and returns a new tree.
 * The Go equivalent is addAppLinks in
 * pkg/services/navtree/navtreeimpl/applinks.go.
 *
 * Apps are placed in the section their nav config names, falling back to
 * "More apps" under their own plugin.json name, and the cross-plugin overrides
 * are applied once every app is known.
 *
 * The [navigation.app_sections] and [navigation.app_standalone_pages] INI
 * overrides are not reproduced; app_sections needs a backend half to deliver it
 * through frontend settings.
 *
 * `staticTree` must come straight from buildStaticNavTree: a tree that already
 * holds plugin items gains them a second time, and the urls must still be
 * app-sub-url relative, because the caller applies that prefix once after this
 * returns.
 *
 * Permanent divergences from the Go builder: per-org plugin enablement is not
 * readable client-side, and nor is the assistant's jsonData gating beyond the
 * deployment-mode half reproduced in APP_NAV_CONFIG; includes are appended flat
 * rather than nested under their path ancestor; and page includes with no path
 * have no URL to link to.
 */
export function mergePluginNavIntoTree(apps: AppPluginConfig[], staticTree: NavModelItem[]): NavModelItem[] {
  const installedPluginIds: ReadonlySet<string> = new Set(apps.map((app) => app.id));
  let tree = staticTree;

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

  return sortNavTree(pruneEmptyNavSections(tree));
}

/**
 * Builds the nav items for one app plugin and returns a new tree with the app
 * link (or its hoisted pages) placed into its section.
 *
 * An app with no accessible nav children is not part of the tree. That is
 * decided on navChildren, before the default nav is folded out: an app whose
 * only page IS its default nav still belongs in the tree, as a link with no
 * children of its own. The Go builder orders these two steps the same way.
 */
function addAppToTree(tree: NavModelItem[], app: AppPluginConfig): NavModelItem[] {
  const { appLink, navChildren } = buildAppLink(app);
  if (navChildren.length === 0) {
    return tree;
  }
  return placeAppInSection(tree, app, withAppNavConfig(app, appLink));
}

/**
 * Builds the app's nav link from its page and dashboard includes. Returns the
 * accessible includes as navChildren too, unfiltered, so the caller can tell an
 * app with no nav items from one whose only item folded into the app link.
 */
function buildAppLink(app: AppPluginConfig): { appLink: NavModelItem; navChildren: NavModelItem[] } {
  let appUrl = `/a/${app.id}`;
  const children: NavModelItem[] = [];
  const filterInclude = appNavConfigFor(app.id)?.filterInclude;

  for (const include of app.includes ?? []) {
    if (!hasAccessToInclude(include) || (filterInclude && !filterInclude(include))) {
      continue;
    }

    if (include.type === PluginIncludeType.dashboard) {
      if (include.addToNav && include.uid) {
        children.push({
          url: `/d/${include.uid}`,
          text: include.name,
          pluginId: app.id,
        });
      }
      continue;
    }

    // Pathless page includes are component pages: no URL to link to
    if (include.type !== PluginIncludeType.page || !include.path) {
      continue;
    }

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

  return {
    appLink: {
      text: app.name ?? app.id,
      id: pluginPageId(app.id),
      img: app.info?.logos?.small,
      subTitle: app.info?.description,
      sortWeight: NavWeight.plugin,
      isSection: true,
      pluginId: app.id,
      url: appUrl,
      // Children matching the app default nav are folded into the app link itself
      children: children.filter((child) => child.url !== appUrl),
    },
    navChildren: children,
  };
}

/** Applies the app's built-in nav config: placement, weight and display overrides */
function withAppNavConfig(app: AppPluginConfig, appLink: NavModelItem): NavModelItem {
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
function placeAppInSection(tree: NavModelItem[], app: AppPluginConfig, appLink: NavModelItem): NavModelItem[] {
  const navConfig = appNavConfigFor(app.id);
  const sectionId = navConfig?.sectionId ?? NavID.apps;

  const sectionChildren = navConfig?.hoistPages ? hoistAppPages(appLink, navConfig.hoistPages) : [appLink];

  const placed = appendIntoSection(tree, sectionId, sectionChildren);
  if (placed) {
    return placed;
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
      ...(imgFromAppLogo && app.info?.logos && { img: config.appSubUrl + app.info.logos.large }),
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
 * The starred and bookmarks containers are filled at runtime, so a freshly
 * built tree has them empty; their children are copied over from the tree in
 * the store. Applied by the dispatcher (useNavTree), which keeps
 * mergePluginNavIntoTree a pure function of the plugin metas.
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

// Whether the user may see one of an app's pages. An include declaring an RBAC
// action is gated on that action; otherwise the user's org role must rank at or
// above the include's role. The action is evaluated unscoped: the frontend
// permissions map flattens scopes away, so the per-plugin scope the server
// applies (plugins:id:*) cannot be checked here.
function hasAccessToInclude(include: PluginInclude): boolean {
  const ORG_ROLE_RANK: Record<string, number> = { None: 0, Viewer: 1, Editor: 2, Admin: 3 };

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
