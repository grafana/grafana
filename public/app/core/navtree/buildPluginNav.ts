import { cloneDeep } from 'lodash';

import {
  type AppPluginConfig,
  isIconName,
  type NavModelItem,
  type PluginInclude,
  PluginIncludeType,
} from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { buildStaticNavTree } from './buildStaticNavTree';
import { MORE_APPS_SHELL, NavID, NavWeight } from './constants';
import { appendIntoSection, applyAppSubUrl, pluginPageId, pruneEmptyNavSections, sortNavTree } from './utils';

/**
 * Merges app-plugin nav items into the client-built tree and returns a new
 * tree. The Go equivalent is addAppLinks in
 * pkg/services/navtree/navtreeimpl/applinks.go, kept behaviourally in sync.
 *
 * Every app lands in "More apps" under its own plugin.json name for now. The
 * rest of what the server does lands separately, each on its own:
 * - per-app placement: the section an app belongs to and the name, icon and
 *   weight it renders with there
 * - the cross-plugin adjustments the server applies once every app is known
 *   (the Assistant stub, maintenance windows nesting under SLO, Service Center
 *   from SLO, the Adaptive Telemetry umbrella link, Help opening interactive
 *   learning)
 * - hoisting an app's pages into its section as standalone entries
 * - operator nav overrides from the INI: [navigation.app_sections] needs a
 *   backend half to deliver it through frontend settings;
 *   [navigation.app_standalone_pages] has no client equivalent
 *
 * Deliberately not reproduced:
 * - per-org plugin enablement: presence in the namespace counts as enabled
 * - the per-plugin scope on plugins.app:access (see the TODO below)
 * - assistant pages gated on per-org plugin jsonData, which the client cannot
 *   read
 * - nesting includes under their path ancestor (grafana.pluginPathNesting);
 *   includes are appended flat for now
 * - page includes with no path, which have no URL to link to
 */
export function mergePluginNavIntoTree(apps: AppPluginConfig[]): NavModelItem[] {
  // Build a fresh static tree rather than merging into the current slice
  // state, so a re-merge cannot duplicate plugin items. Runtime-filled
  // containers are carried over separately by carryOverRuntimeChildren.
  let tree = buildStaticNavTree();

  // TODO: evaluate this per plugin (plugins:id:<id>) as the server does, which
  // needs the scoped permissions the bootdata map flattens away. Until then one
  // coarse check grants every app at once.
  if (contextSrv.hasPermission(AccessControlAction.PluginsAppAccess)) {
    for (const app of apps) {
      try {
        tree = addAppToTree(tree, app);
      } catch (error) {
        console.warn('[navtree] failed to build nav for app plugin', app.id, error);
      }
    }
  }

  return applyAppSubUrl(sortNavTree(pruneEmptyNavSections(tree)));
}

/**
 * Builds the nav items for one app plugin and returns a new tree with the app
 * link placed into the "More apps" section. An app with no accessible nav
 * children is not part of the tree.
 */
function addAppToTree(tree: NavModelItem[], app: AppPluginConfig): NavModelItem[] {
  const appLink = buildAppLink(app);
  if ((appLink.children ?? []).length === 0) {
    return tree;
  }
  return placeInMoreApps(tree, appLink);
}

/** Builds the app's nav link from its page and dashboard includes */
function buildAppLink(app: AppPluginConfig): NavModelItem {
  let appUrl = `/a/${app.id}`;
  const children: NavModelItem[] = [];

  for (const include of app.includes ?? []) {
    if (!hasAccessToInclude(include)) {
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
  };
}

/**
 * Appends the app link to the "More apps" section, creating that section from
 * its shell if this is the first app to be merged in. Returns a new tree.
 */
function placeInMoreApps(tree: NavModelItem[], appLink: NavModelItem): NavModelItem[] {
  const placed = appendIntoSection(tree, NavID.apps, [appLink]);
  return placed ?? [...tree, { ...MORE_APPS_SHELL, children: [appLink] }];
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
