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

/** Move the element at `from` to `to`, returning a new array (no-op for out-of-range indices). */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// ----- Hiding -----

/**
 * Items that can never be hidden/renamed/reordered, so users can't customise their way out of the
 * home page (reached via the logo, not a menu row anyway — this is just belt-and-suspenders).
 */
const PROTECTED_NAV_IDS = new Set(['home']);

/**
 * Items the mega menu never lists directly (surfaced elsewhere in the chrome). Home is reached via
 * the logo, so it isn't repeated as a menu item.
 */
export const NON_MENU_NAV_IDS = new Set(['profile', 'help', HOME_NAV_ID]);

/**
 * The stable key identifying an item for hiding — its id, or its url when it has no id (plugin nav
 * items often have only a url). Everything hiding-related keys on this so any linked row can be hidden.
 */
export const hiddenKey = (item: NavModelItem): string => item.id ?? item.url ?? '';

/**
 * Whether an item can be customised (hidden, renamed or reordered) at any depth. Needs an id or
 * url; excludes Home, create actions and the dynamic starred sub-items (the `starred/` id prefix).
 * Gates the hide/rename/move controls uniformly — one predicate for all three actions.
 */
export const isHideable = (item: NavModelItem): boolean =>
  Boolean(hiddenKey(item)) &&
  !PROTECTED_NAV_IDS.has(item.id ?? '') &&
  !item.isCreateAction &&
  !item.id?.startsWith(ID_PREFIX);

// Children that can be hidden — used when "breaking apart" a hidden parent.
const hideableChildren = (item: NavModelItem): NavModelItem[] => (item.children ?? []).filter(isHideable);

/**
 * Build the normal nav with hidden items removed. A hidden node takes its subtree with it; a
 * partially-hidden parent keeps its non-hidden children (so all-children-hidden still shows the parent).
 */
export function removeHiddenItems(items: NavModelItem[], hidden: Set<string>): NavModelItem[] {
  return items
    .filter((item) => !hidden.has(hiddenKey(item)))
    .map((item) => (item.children ? { ...item, children: removeHiddenItems(item.children, hidden) } : item));
}

/** All descendant keys of an item. */
function getDescendantKeys(item: NavModelItem): string[] {
  return (item.children ?? []).flatMap((child) => {
    const key = hiddenKey(child);
    return [...(key ? [key] : []), ...getDescendantKeys(child)];
  });
}

/** Hide an item: add its key and drop any of its now-redundant descendant keys. Never adds the parent. */
export function hideItem(hidden: string[], items: NavModelItem[], key: string): string[] {
  const node = findPath(items, (item) => hiddenKey(item) === key)?.at(-1);
  const descendants = new Set(node ? getDescendantKeys(node) : []);
  return [...hidden.filter((h) => h !== key && !descendants.has(h)), key];
}

/**
 * Reveal an item. If it's hidden via an ancestor, "break apart" that hide: remove the hidden
 * ancestor and hide every off-path sibling down the path to the item, so only the item's path is
 * revealed and the rest of the hidden subtree stays hidden. If it was only explicitly hidden,
 * this just removes its key.
 */
export function revealItem(hidden: string[], items: NavModelItem[], key: string): string[] {
  const path = findPath(items, (item) => hiddenKey(item) === key);
  const next = new Set(hidden);
  next.delete(key);
  if (!path) {
    return [...next];
  }
  let underHidden = false;
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    const onPathChildKey = hiddenKey(path[i + 1]);
    const nodeKey = hiddenKey(node);
    if (nodeKey && next.has(nodeKey)) {
      next.delete(nodeKey);
      underHidden = true;
    }
    if (underHidden) {
      for (const child of hideableChildren(node)) {
        const childKey = hiddenKey(child);
        if (childKey && childKey !== onPathChildKey) {
          next.add(childKey);
        }
      }
    }
  }
  return [...next];
}

// ----- Renaming, hiding and reordering (any depth) -----

/**
 * The mega menu customisation, staged/applied as one blob: renamed labels, hidden keys, and the
 * child order per parent (keyed by the parent's own `hiddenKey`, or `ROOT_ORDER_KEY` for the
 * top-level list). Hacky by design — a single localStorage-backed blob for testing nav naming and
 * ordering, not a production preferences feature.
 */
export interface NavCustomizationState {
  renamed: Record<string, string>;
  hidden: string[];
  order: Record<string, string[]>;
}

export const EMPTY_NAV_CUSTOMIZATION: NavCustomizationState = { renamed: {}, hidden: [], order: {} };

/** The `order` key for the top-level nav list (nested lists are keyed by their parent's `hiddenKey`). */
export const ROOT_ORDER_KEY = '__root__';

/**
 * Order `items` by the user's stored key order (`orderedKeys`): items appear in that order; any not
 * in the list (e.g. a newly-added item) keep their nav-tree position and sort after.
 */
export function applyOrder(items: NavModelItem[], orderedKeys: string[]): NavModelItem[] {
  const rank = (item: NavModelItem) => {
    const index = orderedKeys.indexOf(hiddenKey(item));
    return index === -1 ? Infinity : index;
  };
  return items
    .map((item, navIndex) => ({ item, navIndex }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.navIndex - b.navIndex)
    .map(({ item }) => item);
}

/**
 * Apply renames and ordering (any depth) to a nav tree. Hiding is deliberately not applied here —
 * callers compose with `removeHiddenItems` separately so hidden items can still be shown (greyed)
 * while editing.
 */
export function applyNavCustomization(
  items: NavModelItem[],
  customization: NavCustomizationState,
  parentKey: string = ROOT_ORDER_KEY
): NavModelItem[] {
  const ordered = applyOrder(items, customization.order[parentKey] ?? []);
  return ordered.map((item) => {
    const key = hiddenKey(item);
    const renamedText = customization.renamed[key];
    return {
      ...item,
      text: renamedText ?? item.text,
      children: item.children ? applyNavCustomization(item.children, customization, key) : item.children,
    };
  });
}

/** Stage (or clear, for an empty string) a rename of the item keyed by `key`. */
export function renameNavItem(customization: NavCustomizationState, key: string, text: string): NavCustomizationState {
  const trimmed = text.trim();
  const renamed = { ...customization.renamed };
  if (trimmed) {
    renamed[key] = trimmed;
  } else {
    delete renamed[key];
  }
  return { ...customization, renamed };
}

/** Stage a hide/reveal toggle of the item keyed by `key` (delegates to hideItem/revealItem above). */
export function toggleNavItemHidden(
  baseItems: NavModelItem[],
  customization: NavCustomizationState,
  key: string,
  currentlyHidden: boolean
): NavCustomizationState {
  const hidden = currentlyHidden
    ? revealItem(customization.hidden, baseItems, key)
    : hideItem(customization.hidden, baseItems, key);
  return { ...customization, hidden };
}

/** The array an item (keyed by `key`) currently lives in, and the `order` key that array is stored
 * under (the parent's `hiddenKey`, or `ROOT_ORDER_KEY` at the top level). */
function findSiblingsContext(
  items: NavModelItem[],
  key: string,
  parentKey: string
): { siblings: NavModelItem[]; parentKey: string } | null {
  for (const item of items) {
    if (hiddenKey(item) === key) {
      return { siblings: items, parentKey };
    }
    if (item.children) {
      const found = findSiblingsContext(item.children, key, hiddenKey(item));
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Move the item keyed by `key` one step up/down among its current siblings (any depth), staging
 * the new order for that item's parent. A no-op (returns `customization` unchanged) if the item
 * isn't found or is already at the boundary in that direction.
 */
export function moveNavItem(
  baseItems: NavModelItem[],
  customization: NavCustomizationState,
  key: string,
  direction: -1 | 1
): NavCustomizationState {
  // Move within the currently displayed order, not the raw nav-tree order.
  const displayed = applyNavCustomization(baseItems, customization);
  const context = findSiblingsContext(displayed, key, ROOT_ORDER_KEY);
  if (!context) {
    return customization;
  }
  const ids = context.siblings.map(hiddenKey);
  const fromIndex = ids.indexOf(key);
  const nextIds = moveItem(ids, fromIndex, fromIndex + direction);
  if (nextIds === ids) {
    return customization;
  }
  return { ...customization, order: { ...customization.order, [context.parentKey]: nextIds } };
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
