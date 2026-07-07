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

/** First index in `orderUrls` at which any of the item's (section or leaf) urls appears, else Infinity. */
function firstPinnedIndex(item: NavModelItem, orderUrls: string[]): number {
  const urls = new Set<string>(getPinnableLeafUrls(item));
  if (item.url) {
    urls.add(item.url);
  }
  const index = orderUrls.findIndex((url) => urls.has(url));
  return index === -1 ? Infinity : index;
}

/**
 * Order top-level items by the user-defined pin order (`orderUrls`, the stored bookmark list):
 * items appear in the order their urls first show up in `orderUrls`; anything not yet in that list
 * (e.g. a freshly-pinned item) keeps its nav-tree position and sorts after the known ones. Passing
 * an empty `orderUrls` therefore leaves the nav-tree order untouched.
 */
function orderByPins(items: NavModelItem[], orderUrls: string[]): NavModelItem[] {
  return items
    .map((item, navIndex) => ({ item, navIndex }))
    .sort(
      (a, b) => firstPinnedIndex(a.item, orderUrls) - firstPinnedIndex(b.item, orderUrls) || a.navIndex - b.navIndex
    )
    .map(({ item }) => item);
}

/** Whether an item is pinned in its own right (its url is in the pinned set). */
function isItemPinned(item: NavModelItem, pinned: Set<string>): boolean {
  return Boolean(item.url && pinned.has(item.url));
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
function buildPinnedBranch(items: NavModelItem[], pinned: Set<string>): NavModelItem[] {
  return items
    .filter((item) => hasPinnedItem(item, pinned))
    .map((item) => {
      if (isItemPinned(item, pinned)) {
        // A directly-pinned node is the endpoint of its branch — shown without expanding its children.
        return { ...item, children: undefined };
      }
      const children = pinnableChildren(item);
      return children.length > 0
        ? { ...item, children: buildPinnedBranch(children, pinned) }
        : { ...item, children: undefined };
    });
}

/**
 * The pinned mini-tree for the box: each pinned item shown under its ancestor chain (structural
 * ancestors kept only for the branches that lead to a pin; pinned nodes are non-expanded endpoints).
 * Top-level blocks are ordered by the user's pin order (`orderUrls`). Pins are duplicates — the main
 * nav is never pruned, so there is no "rest"/partition step any more.
 */
export function buildPinnedTree(items: NavModelItem[], pinned: Set<string>, orderUrls: string[] = []): NavModelItem[] {
  return orderByPins(buildPinnedBranch(items, pinned), orderUrls);
}

/**
 * Move the top-level pinned block at `fromIndex` to `toIndex` and rebuild the canonical stored url
 * list so the block order reflects the new arrangement (each block's urls stay grouped together).
 */
export function reorderPinnedBlocks(
  orderUrls: string[],
  items: NavModelItem[],
  fromIndex: number,
  toIndex: number
): string[] {
  const blocks = buildPinnedTree(items, new Set(orderUrls), orderUrls);
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= blocks.length || toIndex >= blocks.length) {
    return orderUrls;
  }
  const reordered = [...blocks];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered.flatMap((block) => {
    const leaves = new Set(getPinnableLeafUrls(block));
    return orderUrls.filter((url) => url === block.url || leaves.has(url));
  });
}

// ----- Hiding -----

// Top-level items that can never be hidden, so users can't customise their way out of the home
// page or the bookmarks section (itself a customisation surface). Starred is pinnable instead of
// hideable, so it's protected here too.
const PROTECTED_NAV_IDS = new Set(['home', 'bookmarks', 'starred']);

// Items the mega menu never lists directly (surfaced elsewhere in the chrome). Home is reached via
// the logo, so it isn't repeated as a menu item.
export const NON_MENU_NAV_IDS: Record<string, true> = { profile: true, help: true, [HOME_NAV_ID]: true };

/** Whether a (top-level) section can be hidden. Excludes Home/Bookmarks/Starred. Hiding is top-level only. */
export const isHideable = (item: NavModelItem): boolean => Boolean(item.id) && !PROTECTED_NAV_IDS.has(item.id ?? '');

/** Drop the hidden top-level sections (by id). Hiding is top-level only, so no recursion is needed. */
export function removeHiddenItems(items: NavModelItem[], hidden: Set<string>): NavModelItem[] {
  return items.filter((item) => !hidden.has(item.id ?? ''));
}

// ----- Top-level ordering -----

/**
 * Order the top-level sections by the user's stored order (`orderedIds`): sections appear in that
 * order; any not in the list (e.g. a newly-added section) keep their nav-tree position and sort after.
 */
export function orderTopLevelSections(items: NavModelItem[], orderedIds: string[]): NavModelItem[] {
  const rank = (item: NavModelItem) => {
    const index = orderedIds.indexOf(item.id ?? '');
    return index === -1 ? Infinity : index;
  };
  return items
    .map((item, navIndex) => ({ item, navIndex }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.navIndex - b.navIndex)
    .map(({ item }) => item);
}

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
