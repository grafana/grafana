import {
  type AppPluginConfig,
  isIconName,
  type NavModelItem,
  type PluginInclude,
  PluginIncludeType,
} from '@grafana/data';
import { getAppPluginMetasSync } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { getNavTitle } from 'app/core/utils/navBarItem-translations';
import { AccessControlAction } from 'app/types/accessControl';

import { MORE_APPS_SHELL, NavID, NavWeight } from './constants';
import { appendIntoSection, arePluginNavItemsEnabled, pluginPageId } from './utils';

// Whether the user may see one of an app's pages. An include declaring an RBAC
// action is gated on that action; otherwise the user's org role must rank at or
// above the include's role. The action is evaluated unscoped: the frontend
// permissions map flattens scopes away, so the per-plugin scope the server
// applies (plugins:id:*) cannot be checked here.
const ORG_ROLE_RANK: Record<string, number> = { None: 0, Viewer: 1, Editor: 2, Admin: 3 };

// Apps all carry the same sort weight, so sortNavTree leaves them in whatever
// order they were placed. Order them here, by the title getNavTitle resolves —
// which is also the text the nav slices go on to display, so the order the user
// reads and the order built here cannot drift apart.
const collator = new Intl.Collator();

/**
 * Folds the installed app plugins into the nav tree and returns a new tree.
 * The Go equivalent is addAppLinks in
 * pkg/services/navtree/navtreeimpl/applinks.go.
 *
 * Every app lands in "More apps" under its own plugin.json name. The section is
 * created from its shell by the first app to need it.
 *
 * Call it with a tree whose sections are already built, and sort the result:
 * apps carry weights that only take effect downstream. Urls stay app-sub-url
 * relative, because getInitialNavTree applies that prefix once at the end.
 *
 * Permanent divergences from the Go builder: per-org plugin enablement and the
 * assistant's jsonData gating are not readable client-side; includes are
 * appended flat rather than nested under their path ancestor; and page includes
 * with no path have no URL to link to.
 */
export function applyPluginNav(tree: NavModelItem[], apps: AppPluginConfig[]): NavModelItem[] {
  if (!contextSrv.hasPermission(AccessControlAction.PluginsAppAccess)) {
    return tree;
  }

  let next = tree;

  for (const app of byTitle(apps)) {
    try {
      const { appLink, navChildren } = buildAppLink(app);
      // An app with no accessible nav children is not part of the tree. That is
      // decided on navChildren, before the default nav is folded out: an app
      // whose only page IS its default nav still belongs in the tree, as a link
      // with no children of its own. The Go builder orders these two the same way.
      if (navChildren.length === 0) {
        continue;
      }
      next = placeInMoreApps(next, appLink);
    } catch (error) {
      // One malformed plugin meta costs its own app and nothing else: this runs
      // while the redux store is being created, so a throw would take the tree
      console.warn('[navtree] failed to build nav for app plugin', app.id, error);
    }
  }

  return next;
}

/**
 * The tree-building entry point: reads the app metas cache and folds them in.
 *
 * Everything below this is a pure function of the tree and the app list, which
 * is what the tests exercise. This wrapper owns the two things that are not:
 * the flag gate and the cache read.
 */
export function withPluginNav(tree: NavModelItem[]): NavModelItem[] {
  // arePluginNavItemsEnabled() has to come first. app.ts only fills the metas
  // cache under that same flag, and getAppPluginMetasSync() throws in
  // development builds when it is empty.
  if (!arePluginNavItemsEnabled()) {
    return tree;
  }

  try {
    return applyPluginNav(tree, getAppPluginMetasSync());
  } catch (error) {
    // Nothing above catches for us, and this builds the tree the redux store is
    // created from — so an escaping throw is a blank page, not a missing section
    console.error('[navtree] failed to apply plugin nav', error);
    return tree;
  }
}

/** The app plugins, ordered by the title the user reads. Returns a new array. */
function byTitle(apps: AppPluginConfig[]): AppPluginConfig[] {
  // Resolve each title once rather than inside the comparator, which would call
  // t() O(n log n) times
  return apps
    .map((app) => ({ app, title: getNavTitle(pluginPageId(app.id)) ?? app.name ?? app.id }))
    .sort((a, b) => collator.compare(a.title, b.title))
    .map(({ app }) => app);
}

/**
 * Appends the app link to the "More apps" section, creating that section from
 * its shell if this is the first app to need it. Returns a new tree.
 */
function placeInMoreApps(tree: NavModelItem[], appLink: NavModelItem): NavModelItem[] {
  const placed = appendIntoSection(tree, NavID.apps, [appLink]);
  return placed ?? [...tree, { ...MORE_APPS_SHELL, children: [appLink] }];
}

/**
 * Builds the app's nav link from its page and dashboard includes. Returns the
 * accessible includes as navChildren too, unfiltered, so the caller can tell an
 * app with no nav items from one whose only item folded into the app link.
 */
function buildAppLink(app: AppPluginConfig): { appLink: NavModelItem; navChildren: NavModelItem[] } {
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
    appLink: {
      text: app.name ?? app.id,
      id: pluginPageId(app.id),
      img: app.info?.logos?.small,
      subTitle: app.info?.description,
      // Every app link carries the same weight, so sortNavTree sees a tie at
      // every comparison and its stable sort keeps the order byTitle set.
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
