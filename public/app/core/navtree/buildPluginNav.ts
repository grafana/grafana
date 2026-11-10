import {
  type AppPluginConfig,
  isIconName,
  type NavModelItem,
  type PluginInclude,
  PluginIncludeType,
} from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { getNavTitle } from 'app/core/utils/navBarItem-translations';
import { AccessControlAction } from 'app/types/accessControl';

import { type AppNavConfig, appNavConfigFor, appNavPathConfigFor, isOperatorPlacedSection } from './appNavConfig';
import { NavID, NavWeight, PLUGIN_SECTION_SHELLS } from './constants';
import { PLUGIN_NAV_OVERRIDES } from './pluginNavOverrides';
import {
  appendIntoSection,
  findNavById,
  hoistAppPages,
  isPluginPathNestingEnabled,
  pluginPageId,
  standalonePluginPageId,
  updateNavById,
  withAppSubUrl,
} from './utils';

// Whether the user may see one of an app's pages. An include declaring an RBAC
// action is gated on that action; otherwise the user's org role must rank at or
// above the include's role. The action is evaluated unscoped: the frontend
// permissions map flattens scopes away, so the per-plugin scope the server
// applies (plugins:id:*) cannot be checked here.
const ORG_ROLE_RANK: Record<string, number> = { None: 0, Viewer: 1, Editor: 2, Admin: 3 };

// Apps with no nav config all carry the same sort weight, so sortNavTree leaves
// them in whatever order they were placed. Order them here, by the title
// getNavTitle resolves — which is also the text the nav slices go on to display,
// so the order the user reads and the order built here cannot drift apart.
const collator = new Intl.Collator();

/**
 * Folds the installed app plugins into the nav tree and returns a new tree.
 * The Go equivalent is addAppLinks in
 * pkg/services/navtree/navtreeimpl/applinks.go.
 *
 * The cross-plugin overrides run last, once every app is known.
 *
 * Call it with a tree whose sections are already built, and sort the result:
 * apps carry weights that only take effect downstream. Urls stay app-sub-url
 * relative, because getInitialNavTree applies that prefix once at the end.
 *
 * The client cannot read per-org plugin enablement or a plugin's jsonData, so
 * anything the Go builder gates on those is out of reach here.
 */
export function applyPluginNav(tree: NavModelItem[], apps: AppPluginConfig[]): NavModelItem[] {
  if (!contextSrv.hasPermission(AccessControlAction.PluginsAppAccess)) {
    return tree;
  }

  const installedPluginIds: ReadonlySet<string> = new Set(apps.map((app) => app.id));
  let next = tree;

  for (const app of byTitle(apps)) {
    try {
      const { appLink, navChildren, standalonePages } = buildAppLink(app, next);
      // Built up locally and committed in one go, so a throw part-way through
      // leaves none of this app behind — not even its standalone pages
      let withApp = next;
      // An app with no accessible nav children is not part of the tree, though
      // its lifted pages still are. That is decided on navChildren, before the
      // default nav is folded out: an app whose only page IS its default nav
      // still belongs in the tree, as a link with no children of its own. The
      // Go builder orders these two the same way.
      if (navChildren.length > 0) {
        withApp = placeAppInSection(withApp, app, withAppNavConfig(app, appLink));
      }
      // After the app, because a page lifted into the same section as its own
      // app needs that section to exist — sections are created on demand by the
      // first app targeting them, which may well be this one
      for (const page of standalonePages) {
        withApp = placeStandalonePage(withApp, page);
      }
      next = withApp;
    } catch (error) {
      // One malformed plugin meta costs its own app and nothing else: this runs
      // while the redux store is being created, so a throw would take the tree
      console.warn('[navtree] failed to build nav for app plugin', app.id, error);
    }
  }

  // Last, because each override reads nodes other apps placed
  for (const override of PLUGIN_NAV_OVERRIDES) {
    if (override.when(next, installedPluginIds)) {
      next = override.apply(next, installedPluginIds);
    }
  }

  return next;
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
 * Builds the app's nav link from its page and dashboard includes. Returns the
 * accessible includes as navChildren too, unfiltered, so the caller can tell an
 * app with no nav items from one whose only item folded into the app link.
 */
function buildAppLink(
  app: AppPluginConfig,
  tree: NavModelItem[]
): {
  appLink: NavModelItem;
  navChildren: NavModelItem[];
  standalonePages: StandalonePage[];
} {
  let appUrl = `/a/${app.id}`;
  const nestByPath = isPluginPathNestingEnabled();
  // Attachment waits for a second pass, so nesting does not depend on the order
  // the includes happen to appear in plugin.json
  const pending: PendingInclude[] = [];
  const pageLinks: NavModelItem[] = [];
  const standalonePages: StandalonePage[] = [];
  const navConfig = appNavConfigFor(app.id);
  const { filterInclude } = navConfig ?? {};

  for (const include of app.includes ?? []) {
    if (!hasAccessToInclude(include) || (filterInclude && !filterInclude(include))) {
      continue;
    }

    if (include.type === PluginIncludeType.dashboard) {
      if (include.addToNav && include.uid) {
        // Dashboards never nest
        pending.push({
          link: { url: `/d/${include.uid}`, text: include.name, pluginId: app.id },
          isPage: false,
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

    const link: NavModelItem = {
      text: include.name,
      icon: toIconName(include.icon),
      pluginId: app.id,
      url: include.path,
    };

    // A page with its own placement leaves the app entirely, so it is not one of
    // the app's nav children: an app whose only page is relocated drops out.
    // The placement comes from our config rather than the plugin, so it applies
    // whatever addToNav says — plugins should not lean on that, a page meant for
    // the nav sets addToNav.
    const pathConfig = appNavPathConfigFor(include.path);
    if (pathConfig?.hidden) {
      continue;
    }
    if (pathConfig) {
      // A page entry always names a section — only a hidden one may leave it out
      const sectionId = pathConfig.sectionId ?? NavID.apps;
      const standaloneLink = { ...withNavConfig(link, pathConfig), id: standalonePluginPageId(include.path) };
      standalonePages.push({ sectionId, link: standaloneLink });
      // A relocated page parents its descendants only where it can be reached: a
      // page nested under one that never lands would go with it
      if (isSectionReachable(tree, sectionId)) {
        pageLinks.push(standaloneLink);
      }
      continue;
    }

    if (!include.addToNav) {
      continue;
    }

    pending.push({ link, isPage: true });
    // A page sitting at the app root is not a distinct parent: nesting under it
    // and nesting under the app section are the same place, and it is folded out
    // of the children below
    if (cleanNavUrl(link.url) !== cleanNavUrl(appUrl)) {
      pageLinks.push(link);
    }
  }

  const children = attachPendingIncludes(pending, pageLinks, nestByPath);

  return {
    appLink: {
      text: app.name ?? app.id,
      id: pluginPageId(app.id),
      img: app.info?.logos?.small,
      subTitle: app.info?.description,
      // Apps with no nav config all share this weight, so sortNavTree sees a tie
      // at every comparison and its stable sort keeps the order byTitle set.
      sortWeight: NavWeight.plugin,
      isSection: true,
      pluginId: app.id,
      url: appUrl,
      // Children matching the app default nav are folded into the app link itself
      children: children.filter((child) => child.url !== appUrl),
    },
    // Every accessible include, nested or not: an app drops out of the tree only
    // when it has no nav items at all
    navChildren: pending.map(({ link }) => link),
    standalonePages,
  };
}

/** An include waiting for the second pass. Only pages are candidates for nesting. */
interface PendingInclude {
  link: NavModelItem;
  isPage: boolean;
}

/**
 * Attaches each pending include, nesting pages under their nearest path ancestor
 * and returning what is left for the app section. The Go equivalent is
 * attachPendingIncludes in pkg/services/navtree/navtreeimpl/applinks.go.
 */
function attachPendingIncludes(
  pending: PendingInclude[],
  pageLinks: NavModelItem[],
  nestByPath: boolean
): NavModelItem[] {
  const children: NavModelItem[] = [];
  for (const { link, isPage } of pending) {
    const parent = nestByPath && isPage ? nearestAncestorByPath(link, pageLinks) : undefined;
    if (parent) {
      // Safe to mutate: every link here was built by this call and is not shared
      parent.children = [...(parent.children ?? []), link];
      continue;
    }
    children.push(link);
  }
  return children;
}

/**
 * The candidate whose url is the deepest segment prefix of this link's, or
 * undefined when none is — the caller then leaves the link under the app.
 */
function nearestAncestorByPath(link: NavModelItem, candidates: NavModelItem[]): NavModelItem | undefined {
  const child = cleanNavUrl(link.url);
  let best: NavModelItem | undefined;
  for (const candidate of candidates) {
    if (candidate === link) {
      continue;
    }
    const parent = cleanNavUrl(candidate.url);
    // Segment boundaries only, so /settings does not capture /settings-advanced
    if (parent === child || !child.startsWith(`${parent}/`)) {
      continue;
    }
    if (!best || parent.length > cleanNavUrl(best.url).length) {
      best = candidate;
    }
  }
  return best;
}

/** Strips query, fragment and trailing slash so urls compare on segment boundaries */
function cleanNavUrl(url: string | undefined): string {
  const path = url ?? '';
  const end = path.search(/[?#]/);
  return (end >= 0 ? path.slice(0, end) : path).replace(/\/+$/, '');
}

/**
 * Whether a relocated page's section will be there to receive it: either it is
 * already in the tree, or an app is about to build it from its shell.
 */
function isSectionReachable(tree: NavModelItem[], sectionId: string): boolean {
  return sectionId === NavID.root || Boolean(findNavById(tree, sectionId)) || sectionId in PLUGIN_SECTION_SHELLS;
}

/** A page lifted out of its app, with the section it belongs in */
interface StandalonePage {
  sectionId: string;
  link: NavModelItem;
}

/**
 * Places a lifted page at the top level, or into the section it names. A page
 * whose url matches one already in that section replaces it rather than sitting
 * beside it, which is how an operator points a core page at a plugin (Cloud does
 * this for Add new connection and Infrastructure).
 */
function placeStandalonePage(tree: NavModelItem[], { sectionId, link }: StandalonePage): NavModelItem[] {
  const section = findNavById(tree, sectionId);
  const replaced = section?.children?.find((child) => child.url === link.url);
  if (section && replaced) {
    return updateNavById(tree, sectionId, (node) => ({
      ...node,
      children: (node.children ?? []).map((child) =>
        // Only the fields the server copies (applinks.go): the core page keeps its
        // own text, subtitle, keywords and flags, the plugin takes over the routing
        child === replaced
          ? { ...child, id: link.id, sortWeight: link.sortWeight, pluginId: link.pluginId, children: [] }
          : child
      ),
    }));
  }
  return appendIntoSection(tree, sectionId, [link]) ?? tree;
}

/**
 * Applies a nav config's weight and display overrides to a link. Shared by apps
 * and by the pages lifted out of them, as the Go builder shares one
 * NavigationAppConfig between its two tables. Only the keys the config actually
 * sets are spread, so an absent override never clobbers the plugin's own value.
 */
function withNavConfig(link: NavModelItem, { sortWeight, text, subTitle, isNew, icon }: AppNavConfig): NavModelItem {
  return {
    ...link,
    // A config that names no weight means the appended position, as a zero weight
    // does server-side — not "keep the default the link was built with"
    sortWeight: sortWeight ?? 0,
    ...(text !== undefined && { text }),
    ...(subTitle !== undefined && { subTitle }),
    ...(isNew !== undefined && { isNew }),
    ...(icon !== undefined && { icon }),
  };
}

/** Applies the app's own nav config, if it has one */
function withAppNavConfig(app: AppPluginConfig, appLink: NavModelItem): NavModelItem {
  const navConfig = appNavConfigFor(app.id);
  return navConfig ? withNavConfig(appLink, navConfig) : appLink;
}

/**
 * Places the app link into its configured section (default "More apps"),
 * creating the section from its shell if this is the first app targeting it.
 * Returns a new tree.
 */
function placeAppInSection(tree: NavModelItem[], app: AppPluginConfig, appLink: NavModelItem): NavModelItem[] {
  const navConfig = appNavConfigFor(app.id);
  // A hidden app leaves no node behind, but its pages are placed on their own
  // terms: Cloud hides the Collector app and lists three of its pages directly,
  // both through the instance config
  if (navConfig?.hidden) {
    return tree;
  }
  const sectionId = navConfig?.sectionId ?? NavID.apps;

  const sectionChildren = navConfig?.hoistPages ? hoistAppPages(appLink, navConfig.hoistPages) : [appLink];

  const placed = appendIntoSection(tree, sectionId, sectionChildren);
  if (placed) {
    return placed;
  }

  const shellConfig = PLUGIN_SECTION_SHELLS[sectionId];
  if (!shellConfig) {
    // An operator naming a section that does not exist is how an app gets hidden,
    // so only our own tables pointing somewhere unknown is worth warning about
    if (!isOperatorPlacedSection(sectionId)) {
      console.warn('[navtree] plugin app nav id not found', app.id, sectionId);
    }
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
      // applyAppSubUrl only rewrites url, not img, so this one is prefixed by hand
      ...(imgFromAppLogo && app.info?.logos && { img: withAppSubUrl(app.info.logos.large) }),
    },
  ];
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
