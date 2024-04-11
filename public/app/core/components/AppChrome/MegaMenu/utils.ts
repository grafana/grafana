import { NavModelItem } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { t } from 'app/core/internationalization';

import { ShowModalReactEvent } from '../../../../types/events';
import appEvents from '../../../app_events';
import { getFooterLinks } from '../../Footer/Footer';
import { HelpModal } from '../../help/HelpModal';

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

export const enrichWithInteractionTracking = (item: NavModelItem, megaMenuDockedState: boolean) => {
  // creating a new object here to not mutate the original item object
  const newItem = { ...item };
  const onClick = newItem.onClick;
  newItem.onClick = () => {
    reportInteraction('grafana_navigation_item_clicked', {
      path: newItem.url ?? newItem.id,
      menuIsDocked: megaMenuDockedState,
    });
    onClick?.();
  };
  if (newItem.children) {
    newItem.children = newItem.children.map((item) => enrichWithInteractionTracking(item, megaMenuDockedState));
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

/**
 * Override for special cases in the nav.
 *
 * The homepage does not reliably have a `currentPage.id` of `home`.
 * A starred dashboard does not have a `currentPage.id` of `starred/{uid}`
 *
 * These cases are instead driven by parsing the URL of the current page
 *
 * TODO: Fix the nav items for these pages and remove this logic
 */
const getSpecialCaseNavItem: (url: string) => Pick<NavModelItem, 'id'> | undefined = (url) => {
  if (url === '/') {
    return { id: 'home' };
  }

  if (url?.startsWith('/d/')) {
    const id = url.split('/')[2];
    return {
      id: `starred/${id}`,
    };
  }

  return;
};

export const getActiveItem = (
  navTree: NavModelItem[],
  currentPage: Partial<NavModelItem>,
  url?: string
): NavModelItem | undefined => {
  const specialCaseNavItem = url && getSpecialCaseNavItem(url);
  if (specialCaseNavItem) {
    const specialCaseMatch = getActiveItem(navTree, specialCaseNavItem);
    if (specialCaseMatch) {
      return getActiveItem(navTree, specialCaseNavItem);
    }
  }

  const { id, parentItem } = currentPage;

  for (const navItem of navTree) {
    if (navItem.id === id) {
      return navItem;
    }
    if (navItem.children) {
      const childrenMatch = getActiveItem(navItem.children, currentPage, url);
      if (childrenMatch) {
        return childrenMatch;
      }
    }
  }

  if (parentItem) {
    return getActiveItem(navTree, parentItem, url);
  }

  return undefined;
};

export function getEditionAndUpdateLinks(): NavModelItem[] {
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
