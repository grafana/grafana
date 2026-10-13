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

import { NavID, NavWeight } from './constants';
import { arePluginNavItemsEnabled, type NavEntryBuilder, pluginPageId } from './utils';

// Whether the user may see one of an app's pages. An include declaring an RBAC
// action is gated on that action; otherwise the user's org role must rank at or
// above the include's role. The action is evaluated unscoped: the frontend
// permissions map flattens scopes away, so the per-plugin scope the server
// applies (plugins:id:*) cannot be checked here.
const ORG_ROLE_RANK: Record<string, number> = { None: 0, Viewer: 1, Editor: 2, Admin: 3 };

// Both nav slices build from the order this produces, so sort here rather than
// in either of them. The keys come from getNavTitle, which is also what
// translateNav and buildNavIndex display, so the sorted order and the rendered
// order cannot drift apart.
const collator = new Intl.Collator();

/**
 * The "More apps" section: every app plugin's nav items, under its own
 * plugin.json name. The Go equivalent is addAppLinks in
 * pkg/services/navtree/navtreeimpl/applinks.go.
 *
 * Urls are app-sub-url relative, because getInitialNavTree applies that prefix
 * once over the whole tree. The section is built whether or not any app ends up
 * in it, and pruneEmptyNavSections removes it when none does.
 *
 * Permanent divergences from the Go builder: per-org plugin enablement and the
 * assistant's jsonData gating are not readable client-side; includes are
 * appended flat rather than nested under their path ancestor; and page includes
 * with no path have no URL to link to.
 */
export const appsNavEntry: NavEntryBuilder = {
  // arePluginNavItemsEnabled() has to come first. getAppPluginMetasSync() throws
  // in development builds before app.ts has filled the cache, and buildEntries
  // catches that, so the section would disappear with only a console error.
  when: () => arePluginNavItemsEnabled() && contextSrv.hasPermission(AccessControlAction.PluginsAppAccess),
  build: (): NavModelItem => ({
    text: 'More apps',
    icon: 'layer-group',
    subTitle: 'App plugins that extend the Grafana experience',
    id: NavID.apps,
    sortWeight: NavWeight.apps,
    url: '/apps',
    children: buildAppLinks(getAppPluginMetasSync()),
  }),
};

/**
 * Builds one nav link per app plugin, ordered by the title the user reads.
 *
 * A failed app costs only itself: these run while the redux store is being
 * created, so letting one malformed plugin meta throw would take the whole
 * section with it.
 *
 * An app with no accessible nav children is left out. That is decided on
 * navChildren, before the default nav is folded out: an app whose only page IS
 * its default nav still belongs in the tree, as a link with no children of its
 * own. The Go builder orders these two steps the same way.
 */
function buildAppLinks(apps: AppPluginConfig[]): NavModelItem[] {
  const links: NavModelItem[] = [];

  for (const app of apps) {
    try {
      const { appLink, navChildren } = buildAppLink(app);
      if (navChildren.length === 0) {
        continue;
      }
      links.push(appLink);
    } catch (error) {
      console.warn('[navtree] failed to build nav for app plugin', app.id, error);
    }
  }

  // Resolve each title once rather than inside the comparator, which would call
  // t() O(n log n) times
  return links
    .map((link) => ({ link, title: getNavTitle(link.id) ?? link.text }))
    .sort((a, b) => collator.compare(a.title, b.title))
    .map(({ link }) => link);
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
      // every comparison and its stable sort keeps the order set above. Giving
      // apps distinct weights here would silently override it.
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
