import { Dispatch } from '@reduxjs/toolkit';
import { Location } from 'history';

import { locationUtil, NavModelItem, NavSection } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { config } from 'app/core/config';
import { updateMenuTree } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';

import { ShowModalReactEvent } from '../../../types/events';
import appEvents from '../../app_events';
import { getFooterLinks } from '../Footer/Footer';
import { OrgSwitcher } from '../OrgSwitcher';
import { HelpModal } from '../help/HelpModal';

export const SEARCH_ITEM_ID = 'search';
export const NAV_MENU_PORTAL_CONTAINER_ID = 'navbar-menu-portal-container';

export const getNavMenuPortalContainer = () => document.getElementById(NAV_MENU_PORTAL_CONTAINER_ID) ?? document.body;

export const getForcedLoginUrl = (url: string) => {
  const queryParams = new URLSearchParams(url.split('?')[1]);
  queryParams.append('forceLogin', 'true');

  return `${config.appSubUrl}${url.split('?')[0]}?${queryParams.toString()}`;
};

export const enrichConfigItems = (items: NavModelItem[], location: Location<unknown>) => {
  const { isSignedIn, user } = contextSrv;
  const onOpenShortcuts = () => {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  };

  const onOpenOrgSwitcher = () => {
    appEvents.publish(new ShowModalReactEvent({ component: OrgSwitcher }));
  };

  if (user && user.orgCount > 1) {
    const profileNode = items.find((bottomNavItem) => bottomNavItem.id === 'profile');
    if (profileNode) {
      profileNode.showOrgSwitcher = true;
      profileNode.subTitle = `Organization: ${user?.orgName}`;
    }
  }

  if (!isSignedIn) {
    const forcedLoginUrl = getForcedLoginUrl(location.pathname + location.search);

    items.unshift({
      icon: 'signout',
      id: 'signin',
      section: NavSection.Config,
      target: '_self',
      text: 'Sign in',
      url: forcedLoginUrl,
    });
  }

  items.forEach((link) => {
    let menuItems = link.children || [];

    if (link.id === 'help') {
      link.children = [
        ...getFooterLinks(),
        {
          id: 'keyboard-shortcuts',
          text: 'Keyboard shortcuts',
          icon: 'keyboard',
          onClick: onOpenShortcuts,
        },
      ];
    }

    if (link.showOrgSwitcher) {
      link.children = [
        ...menuItems,
        {
          id: 'switch-organization',
          text: 'Switch organization',
          icon: 'arrow-random',
          onClick: onOpenOrgSwitcher,
        },
      ];
    }
  });
  return items;
};

export const enrichClickWith = (item: NavModelItem, withFc: (item: NavModelItem) => void) => {
  const onClick = item.onClick;
  item.onClick = () => {
    withFc(item);

    onClick?.();
  };
  if (item.children) {
    item.children = item.children.map((item) => enrichClickWith(item, withFc));
  }
  return item;
};

export const enrichWithInteractionTracking = (item: NavModelItem, expandedState: boolean) =>
  enrichClickWith(item, (item) => {
    reportInteraction('grafana_navigation_item_clicked', {
      path: item.url ?? item.id,
      state: expandedState ? 'expanded' : 'collapsed',
    });
  });

// @Percona
export const enrichWithClickDispatch = (item: NavModelItem, dispatch: Dispatch, dispatchOffset: number) =>
  enrichClickWith(item, (link) => {
    // let the animation play out, dispatch action after that
    setTimeout(() => {
      if (link.id) {
        dispatch(updateMenuTree({ id: link.id, active: true }));
      }
    }, dispatchOffset);
  });

export const isMatchOrChildMatch = (itemToCheck: NavModelItem, searchItem?: NavModelItem) => {
  return Boolean(itemToCheck === searchItem || hasChildMatch(itemToCheck, searchItem));
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

// @Percona
export const isMatchOrInnerMatch = (itemToCheck: NavModelItem, searchItem?: NavModelItem): boolean => {
  return Boolean(
    itemToCheck === searchItem || itemToCheck.children?.some((child) => isMatchOrInnerMatch(child, searchItem))
  );
};

const stripQueryParams = (url?: string) => {
  return url?.split('?')[0] ?? '';
};

const isBetterMatch = (newMatch: NavModelItem, currentMatch?: NavModelItem) => {
  const currentMatchUrl = stripQueryParams(currentMatch?.url);
  const newMatchUrl = stripQueryParams(newMatch.url);
  return newMatchUrl && newMatchUrl.length > currentMatchUrl?.length;
};

export const getActiveItem = (
  navTree: NavModelItem[],
  pathname: string,
  currentBestMatch?: NavModelItem
): NavModelItem | undefined => {
  const dashboardLinkMatch = '/dashboards';

  for (const link of navTree) {
    const linkWithoutParams = stripQueryParams(link.url);
    const linkPathname = locationUtil.stripBaseFromUrl(linkWithoutParams);
    if (linkPathname) {
      if (linkPathname === pathname) {
        // exact match
        currentBestMatch = link;
        break;
      } else if (linkPathname !== '/' && pathname.startsWith(linkPathname)) {
        // partial match
        if (isBetterMatch(link, currentBestMatch)) {
          currentBestMatch = link;
        }
      } else if (linkPathname === '/alerting/list' && pathname.startsWith('/alerting/notification/')) {
        // alert channel match
        // TODO refactor routes such that we don't need this custom logic
        currentBestMatch = link;
        break;
      } else if (linkPathname === dashboardLinkMatch && pathname.startsWith('/d/')) {
        // dashboard match
        // TODO refactor routes such that we don't need this custom logic
        if (isBetterMatch(link, currentBestMatch)) {
          currentBestMatch = link;
        }
      }
    }
    if (link.children) {
      currentBestMatch = getActiveItem(link.children, pathname, currentBestMatch);
    }
    if (stripQueryParams(currentBestMatch?.url) === pathname) {
      return currentBestMatch;
    }
  }
  return currentBestMatch;
};

export const isSearchActive = (location: Location<unknown>) => {
  const query = new URLSearchParams(location.search);
  return query.get('search') === 'open';
};

export function getNavModelItemKey(item: NavModelItem) {
  return item.id ?? item.text;
}
