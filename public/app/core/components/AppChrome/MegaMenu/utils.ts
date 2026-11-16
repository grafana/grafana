import { useEffect } from 'react';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { MEGA_MENU_TOGGLE_ID } from 'app/core/constants';
import { DASHBOARDS_TAB_NAV_IDS, STARRED_ID_PREFIX } from 'app/core/navtree/constants';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';

import { ShowModalReactEvent } from '../../../../types/events';
import { appEvents } from '../../../app_events';
import { getFooterLinks } from '../../Footer/Footer';

import { DOCK_MENU_BUTTON_ID, MEGA_MENU_HEADER_TOGGLE_ID } from './MegaMenuHeader';

const emitOpenShortcutsModal = async () => {
  const { HelpModal } = await import(/* webpackChunkName: "help-modal" */ '../../help/HelpModal');
  appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
};

export const getEnrichedHelpItem = (helpItem: NavModelItem): NavModelItem => {
  let menuItems = helpItem.children || [];

  if (helpItem.id !== 'help') {
    return helpItem;
  }

  return {
    ...helpItem,
    subTitle: config.buildInfo.versionString,
    children: [
      ...menuItems,
      ...getFooterLinks(),
      ...getEditionAndUpdateLinks(),
      {
        id: 'keyboard-shortcuts',
        text: t('nav.help/keyboard-shortcuts', 'Keyboard shortcuts'),
        icon: 'keyboard',
        onClick: emitOpenShortcutsModal,
      },
    ],
  };
};

export const enrichWithInteractionTracking = (
  item: NavModelItem,
  megaMenuDockedState: boolean,
  ancestorIsNew = false
) => {
  // creating a new object here to not mutate the original item object
  const newItem = { ...item };
  const onClick = newItem.onClick;

  let isNew: 'item' | 'ancestor' | undefined = undefined;
  if (newItem.isNew) {
    isNew = 'item';
  } else if (ancestorIsNew) {
    isNew = 'ancestor';
  }

  newItem.onClick = () => {
    const itemIsStarred = newItem?.parentItem?.id === 'starred';
    reportInteraction('grafana_navigation_item_clicked', {
      path: newItem.url ?? newItem.id,
      menuIsDocked: megaMenuDockedState,
      itemIsBookmarked: newItem?.parentItem?.id === 'bookmarks',
      itemIsStarred,
      itemKind: itemIsStarred ? (newItem.url?.includes('/dashboards/f/') ? 'folder' : 'dashboard') : undefined,
      isNew,
    });
    onClick?.();
  };
  if (newItem.children) {
    newItem.children = newItem.children.map((item) =>
      enrichWithInteractionTracking(item, megaMenuDockedState, isNew !== undefined)
    );
  }
  return newItem;
};

export const hasChildMatch = (itemToCheck: NavModelItem, searchItem?: NavModelItem): boolean => {
  return Boolean(
    itemToCheck.children?.some((child) => {
      if (child === searchItem) {
        return true;
      } else {
        return hasChildMatch(child, searchItem);
      }
    })
  );
};

export const getActiveItem = (
  navTree: NavModelItem[],
  currentPage: NavModelItem,
  url?: string
): NavModelItem | undefined => {
  const { id, parentItem } = currentPage;

  // special case for the home page
  if (url === '/') {
    return navTree.find((item) => item.id === HOME_NAV_ID);
  }

  // special case for profile as it's not part of the mega menu
  if (currentPage.id === 'profile') {
    return undefined;
  }

  for (const navItem of navTree) {
    const isIdMatch = Boolean(navItem.id && navItem.id === id);
    const isTextUrlMatch = navItem.text === currentPage.text && navItem.url === currentPage.url;

    // ideally, we should only match on id
    // unfortunately it's not a required property of the interface, and there are some cases
    // where it's not set, particularly with child pages of plugins
    // in those cases, we fall back to a text + url match
    if (isIdMatch || isTextUrlMatch) {
      return navItem;
    }

    if (navItem.children) {
      const childrenMatch = getActiveItem(navItem.children, currentPage);
      if (childrenMatch) {
        return childrenMatch;
      }
    }
  }

  // Do not search for the parent in the bookmarks section
  const isInBookmarksSection = navTree[0]?.parentItem?.id === 'bookmarks';
  if (parentItem && !isInBookmarksSection) {
    return getActiveItem(navTree, parentItem);
  }

  return undefined;
};

function getEditionAndUpdateLinks(): NavModelItem[] {
  const { buildInfo, licenseInfo } = config;
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';
  const links: NavModelItem[] = [];

  links.push({
    target: '_blank',
    id: 'version',
    text: `${buildInfo.edition}${stateInfo}`,
    url: licenseInfo.licenseUrl,
    icon: 'external-link-alt',
  });

  if (buildInfo.hasUpdate) {
    links.push({
      target: '_blank',
      id: 'updateVersion',
      text: `New version available!`,
      icon: 'download-alt',
      url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
    });
  }

  return links;
}

/**
 * Whether an item can be pinned. "Create" actions are shortcuts, Home is excluded, and individual
 * starred dashboards (the `starred/` id prefix) aren't pinnable — only the Starred section is.
 * This also makes Starred a pinning "leaf" (no pinnable children), so it pins/unpins as a whole
 * regardless of its dynamic children.
 */
const isPinnable = (item: NavModelItem): boolean =>
  Boolean(item.url) && !item.isCreateAction && item.id !== 'home' && !item.id?.startsWith(STARRED_ID_PREFIX);

// Children that participate in pinning.
const pinnableChildren = (item: NavModelItem): NavModelItem[] => (item.children ?? []).filter(isPinnable);

/** The chain of nodes from a root item down to (and including) the first item matching `match`. */
function findPath(items: NavModelItem[], match: (item: NavModelItem) => boolean): NavModelItem[] | null {
  for (const item of items) {
    if (match(item)) {
      return [item];
    }
    const childPath = item.children ? findPath(item.children, match) : null;
    if (childPath) {
      return [item, ...childPath];
    }
  }
  return null;
}

/** One breadcrumb line in the pinned box: the nav item it links to, its ancestor text labels, and
 * the icon of its top-level parent section (shown as the row's leading icon). */
export interface PinnedLine {
  item: NavModelItem;
  ancestors: string[];
  icon?: string;
}

/**
 * A pinned entry (one pinned url). Either a normal pin — rendered as a single breadcrumb `line` — or a
 * whole-section pin (Starred), which carries the `section` node and renders as a collapsible section
 * listing the section's own children.
 */
export type PinnedEntry =
  | { url: string; line: PinnedLine; section?: undefined }
  | { url: string; section: NavModelItem; line?: undefined };

/**
 * Resolve the pinned urls (in their stored order) into entries for the pinned box. A normal url
 * becomes one entry with a single breadcrumb line (its ancestor path + itself). A whole-section pin
 * whose children aren't individually pinnable — i.e. Starred — is flagged with `section` (its node)
 * so the box renders it as a collapsible section listing its children. Urls matching no nav item are
 * skipped.
 */
export function getPinnedEntries(items: NavModelItem[], pinnedUrls: string[]): PinnedEntry[] {
  const entries: PinnedEntry[] = [];
  for (const url of pinnedUrls) {
    const path = findPath(items, (item) => item.url === url);
    if (!path) {
      continue;
    }
    const node = path[path.length - 1];
    const children = (node.children ?? []).filter((child) => !child.isCreateAction);
    // Starred is always a whole-section pin (its children are dynamic and none are individually
    // pinnable) even before its children have loaded — so it keeps the collapsible section layout and
    // its own empty/loading/error state instead of briefly rendering as a plain breadcrumb and then
    // reflowing once children arrive. Any other node is a section only when it currently has children,
    // none of which are individually pinnable.
    const isSection = node.id === 'starred' || (children.length > 0 && pinnableChildren(node).length === 0);
    if (isSection) {
      entries.push({ url, section: node });
    } else {
      const ancestors = path.slice(0, -1).map((item) => item.text);
      // The leading icon comes from the top-level parent section (path[0]) — its own icon for a
      // top-level pin, or the ancestor section's icon for a nested one.
      const icon = path[0].icon;
      entries.push({ url, line: { item: node, ancestors, icon } });
    }
  }
  return entries;
}

/**
 * Items the mega menu never lists directly (surfaced elsewhere in the chrome). Home is reached via
 * the logo, so it isn't repeated as a menu item.
 */
export const NON_MENU_NAV_IDS = new Set(['profile', 'help', HOME_NAV_ID]);

/**
 * Items excluded from the main left navigation for all users, including pins.
 * Use the exact nav item id (e.g. 'explore', 'dashboards/playlists', 'plugin-page-my-app').
 * For items without an id, use their nav URL without the app sub URL; it is added when matching.
 * Hiding a parent also hides its descendants. This only controls menu visibility, not access.
 * Should be a temporary way to fix the menu sprawl until a more robust solution.
 */
export const HIDDEN_NAV_ITEMS = new Set<string>([
  // Shown as tabs on the browse dashboards view instead
  ...DASHBOARDS_TAB_NAV_IDS,

  '/a/grafana-adaptive-metrics-app/configuration',
  '/a/grafana-adaptive-metrics-app/rule-management',
  '/a/grafana-adaptive-metrics-app/segments',

  '/a/grafana-adaptivelogs-app/drop-rules',
  '/a/grafana-adaptivelogs-app/segments',
  '/a/grafana-adaptivelogs-app/patterns',
  '/a/grafana-adaptivelogs-app/exemptions',

  '/a/grafana-adaptivetraces-app/policies',

  '/a/grafana-cmab-app/usage',
  '/a/grafana-cmab-app/cardinality',
  '/a/grafana-cmab-app/attributions',
  '/a/grafana-cmab-app/usage-alerts',
  '/a/grafana-cmab-app/invoices',
  '/a/grafana-cmab-app/settings',
  '/a/grafana-cmab-app/resources',

  'standalone-plugin-page-/a/grafana-collector-app/alloy',
]);

/**
 * The stable key identifying an item for hiding — its id, or its url when it has no id (plugin nav
 * items often have only a url). Everything hiding-related keys on this so any linked row can be hidden.
 */
export const hiddenKey = (item: NavModelItem): string => item.id ?? item.url ?? '';

/**
 * Build the normal nav with hidden items removed. A hidden node takes its subtree with it; a
 * partially-hidden parent keeps its non-hidden children (so all-children-hidden still shows the parent).
 */
export function removeHiddenItems(items: NavModelItem[], hidden: Set<string>): NavModelItem[] {
  return items
    .filter((item) => !hidden.has(hiddenKey(item)))
    .map((item) => (item.children ? { ...item, children: removeHiddenItems(item.children, hidden) } : item));
}

/**
 * Drop the Starred and Bookmarks sections when they have no children. Pending sections (still
 * loading, or failed to load) are kept so their loading or error state stays visible.
 */
export function removeEmptySavedSections(
  items: NavModelItem[],
  { starredPending, bookmarksPending }: { starredPending: boolean; bookmarksPending: boolean }
): NavModelItem[] {
  return items.filter((item) => {
    const isEmpty = !item.children?.length;
    if (item.id === 'starred') {
      return starredPending || !isEmpty;
    }
    if (item.id === 'bookmarks') {
      return bookmarksPending || !isEmpty;
    }
    return true;
  });
}

/**
 * helper to manage focus when opening/closing and docking/undocking the mega menu
 * @param isOpen whether the mega menu is open
 * @param isDocked whether mega menu is docked
 */
export function useMegaMenuFocusHelper(isOpen: boolean, isDocked: boolean) {
  // manage focus when opening/closing
  useEffect(() => {
    if (isOpen) {
      document.getElementById(MEGA_MENU_HEADER_TOGGLE_ID)?.focus();
    } else {
      document.getElementById(MEGA_MENU_TOGGLE_ID)?.focus();
    }
  }, [isOpen]);

  // manage focus when docking/undocking
  useEffect(() => {
    if (isDocked) {
      document.getElementById(DOCK_MENU_BUTTON_ID)?.focus();
    } else {
      document.getElementById(MEGA_MENU_TOGGLE_ID)?.focus();
    }
  }, [isDocked]);
}
