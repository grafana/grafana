import { useEffect } from 'react';

import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { MEGA_MENU_TOGGLE_ID } from 'app/core/constants';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';

import { ShowModalReactEvent } from '../../../../types/events';
import { appEvents } from '../../../app_events';
import { getFooterLinks } from '../../Footer/Footer';
import { HelpModal } from '../../help/HelpModal';

import { DOCK_MENU_BUTTON_ID, MEGA_MENU_HEADER_TOGGLE_ID } from './MegaMenuHeader';

const emitOpenShortcutsModal = () => {
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
    reportInteraction('grafana_navigation_item_clicked', {
      path: newItem.url ?? newItem.id,
      menuIsDocked: megaMenuDockedState,
      itemIsBookmarked: newItem?.parentItem?.id === 'bookmarks',
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
  Boolean(item.url) && !item.isCreateAction && item.id !== 'home' && !item.id?.startsWith(ID_PREFIX);

// Children that participate in pinning.
const pinnableChildren = (item: NavModelItem): NavModelItem[] => (item.children ?? []).filter(isPinnable);

/** Urls of the pinnable leaves under an item — or the item's own url if it has no pinnable children. */
export function getPinnableLeafUrls(item: NavModelItem): string[] {
  const children = pinnableChildren(item);
  if (children.length > 0) {
    return children.flatMap(getPinnableLeafUrls);
  }
  return item.url ? [item.url] : [];
}

/**
 * Expand a stored (canonical) pin set into the flat set of effective leaf urls — a stored section
 * url becomes all its pinnable leaves. A stored url that no longer resolves to a nav item (e.g. the
 * page was removed, a plugin uninstalled, or it's hidden by the current permissions/flags) is kept
 * as-is so the pin isn't silently dropped, and re-resolves if the item comes back.
 */
export function expandPinnedUrls(storedUrls: string[], items: NavModelItem[]): Set<string> {
  const leaves = new Set<string>();
  for (const url of storedUrls) {
    const node = findByUrl(items, url);
    const urls = node ? getPinnableLeafUrls(node) : [url];
    urls.forEach((u) => leaves.add(u));
  }
  return leaves;
}

/**
 * Collapse a flat set of pinned leaf urls back into the canonical stored form: a top-level section
 * whose every pinnable leaf is pinned is stored as the section itself; otherwise its pinned leaves
 * are stored individually. Collapse is top-level only (intermediate groups aren't collapsed).
 */
export function normalizePinnedUrls(leafSet: Set<string>, items: NavModelItem[]): string[] {
  const result: string[] = [];
  for (const item of items) {
    const leaves = getPinnableLeafUrls(item);
    const pinned = leaves.filter((url) => leafSet.has(url));
    if (pinned.length === 0) {
      continue;
    }
    if (item.url && pinned.length === leaves.length) {
      result.push(item.url);
    } else {
      result.push(...pinned);
    }
  }
  return result;
}

/** Whether an item is pinned in its own right (its url is in the pinned set). */
function isItemPinned(item: NavModelItem, pinned: Set<string>): boolean {
  return Boolean(item.url && pinned.has(item.url));
}

/**
 * Whether an item has been "moved" out of the normal nav into the pinned area. An item is moved
 * when it is pinned in its own right (the whole item, including any children), or when it is a
 * section whose every child is moved (so a fully-pinned parent disappears from the normal nav).
 * Pinning is keyed on the item's own url rather than its children so that sections with dynamic
 * children (e.g. "Starred") stay correctly pinned as items are starred/unstarred.
 */
function isNavItemMoved(item: NavModelItem, pinned: Set<string>): boolean {
  if (isItemPinned(item, pinned)) {
    return true;
  }
  const children = pinnableChildren(item);
  return children.length > 0 && children.every((child) => isNavItemMoved(child, pinned));
}

/** Whether an item is pinned itself or has any pinned descendant (so it appears in the pinned area). */
function hasPinnedItem(item: NavModelItem, pinned: Set<string>): boolean {
  return isItemPinned(item, pinned) || pinnableChildren(item).some((child) => hasPinnedItem(child, pinned));
}

/**
 * Build the pinned subtree to render at the top of the menu. A directly-pinned item is kept whole
 * (with all its live children); an item that only has pinned descendants is kept as a structural
 * ancestor with just the branches that lead to a pinned item — so pinning "Playlists" surfaces
 * "Dashboards → Playlists".
 */
function buildPinnedTree(items: NavModelItem[], pinned: Set<string>): NavModelItem[] {
  return items
    .filter((item) => hasPinnedItem(item, pinned))
    .map((item) => {
      if (isItemPinned(item, pinned)) {
        return { ...item };
      }
      const children = pinnableChildren(item);
      return children.length > 0
        ? { ...item, children: buildPinnedTree(children, pinned) }
        : { ...item, children: undefined };
    });
}

/**
 * Build the normal nav with pinned items removed. A partially-pinned section is kept with only
 * its un-pinned children; a fully-pinned section is dropped entirely.
 */
function removeMovedItems(items: NavModelItem[], pinned: Set<string>): NavModelItem[] {
  return items
    .filter((item) => !isNavItemMoved(item, pinned))
    .map((item) => (item.children ? { ...item, children: removeMovedItems(item.children, pinned) } : item));
}

/**
 * Split a nav tree into the pinned subtree (hoisted to the top of the menu) and the rest (with
 * pinned items removed). Single entry point so callers don't orchestrate the two transforms.
 */
export function partitionNavForPinning(
  items: NavModelItem[],
  pinned: Set<string>
): { pinned: NavModelItem[]; rest: NavModelItem[] } {
  return { pinned: buildPinnedTree(items, pinned), rest: removeMovedItems(items, pinned) };
}

// Items the mega menu never lists directly (surfaced elsewhere in the chrome).
export const NON_MENU_NAV_IDS = new Set(['profile', 'help']);

export function findByUrl(nodes: NavModelItem[], url: string): NavModelItem | null {
  for (const item of nodes) {
    if (item.url === url) {
      return item;
    } else if (item.children?.length) {
      const found = findByUrl(item.children, url);
      if (found) {
        return found;
      }
    }
  }
  return null;
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
