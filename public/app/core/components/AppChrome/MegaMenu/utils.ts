import { useEffect } from 'react';

import { NavModelItem } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';

import { ShowModalReactEvent } from '../../../../types/events';
import appEvents from '../../../app_events';
import { getFooterLinks } from '../../Footer/Footer';
import { HelpModal } from '../../help/HelpModal';
import { MEGA_MENU_TOGGLE_ID } from '../TopBar/SingleTopBar';

import { DOCK_MENU_BUTTON_ID, MEGA_MENU_HEADER_TOGGLE_ID } from './MegaMenuHeader';

export const enrichHelpItem = (helpItem: NavModelItem) => {
  let menuItems = helpItem.children || [];

  if (helpItem.id === 'help') {
    const onOpenShortcuts = () => {
      appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
    };
    helpItem.children = [
      ...menuItems,
      ...getFooterLinks(),
      ...getEditionAndUpdateLinks(),
      {
        id: 'keyboard-shortcuts',
        text: t('nav.help/keyboard-shortcuts', 'Keyboard shortcuts'),
        icon: 'keyboard',
        onClick: onOpenShortcuts,
      },
    ];
  }
  return helpItem;
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
      itemIsBookmarked: Boolean(config.featureToggles.pinNavItems && newItem?.parentItem?.id === 'bookmarks'),
      bookmarkToggleOn: Boolean(config.featureToggles.pinNavItems),
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

// Builds "edition/update" links for the Help menu.
// For OSS builds (or when Grafana default upgrading link is detected), we replace the default
// "version/license" item with a Percona Open Source link.
export function getEditionAndUpdateLinks(): NavModelItem[] {
  const { buildInfo, licenseInfo } = config;
  const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';
  const links: NavModelItem[] = [];

  // Detect Grafana's default upgrading/license link (as seen in OSS builds)
  const licenseUrl = licenseInfo.licenseUrl ?? '';
  const isDefaultGrafanaUpgradeLink =
    licenseUrl === '/graph/admin/upgrading' ||
    /grafana\.com\/grafana\/.*upgrade|admin\/upgrading/i.test(licenseUrl);

  // Consider it OSS if edition explicitly contains "open source"
  const isOssEdition = /open\s*source/i.test(buildInfo.edition ?? '');

  if (isDefaultGrafanaUpgradeLink || isOssEdition) {
    // Replace with Percona OSS link
    links.push({
      id: 'open-source',
      text: 'Open source',
      url: 'https://grafana.com/oss/grafana/?utm_source=grafana_footer',
      target: '_blank',
      icon: 'github',
    });
  } else {
    // Keep original behavior for non-OSS or when a specific license URL is provided
    links.push({
      id: 'version',
      text: `${buildInfo.edition}${stateInfo}`,
      url: licenseUrl,
      target: '_blank',
      icon: 'external-link-alt',
    });
  }

  if (buildInfo.hasUpdate) {
    links.push({
      id: 'updateVersion',
      text: 'New version available!',
      url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
      target: '_blank',
      icon: 'download-alt',
    });
  }


  return links;
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
