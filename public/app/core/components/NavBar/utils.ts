import { Location } from 'history';
import { NavModelItem, NavSection } from '@grafana/data';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { ShowModalReactEvent } from '../../../types/events';
import appEvents from '../../app_events';
import { getFooterLinks } from '../Footer/Footer';
import { HelpModal } from '../help/HelpModal';

export const getForcedLoginUrl = (url: string) => {
  const queryParams = new URLSearchParams(url.split('?')[1]);
  queryParams.append('forceLogin', 'true');

  return `${getConfig().appSubUrl}${url.split('?')[0]}?${queryParams.toString()}`;
};

export const enrichConfigItems = (
  items: NavModelItem[],
  location: Location<unknown>,
  toggleOrgSwitcher: () => void
) => {
  const { isSignedIn, user } = contextSrv;
  const onOpenShortcuts = () => {
    appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
  };

  if (user && user.orgCount > 1) {
    const profileNode = items.find((bottomNavItem) => bottomNavItem.id === 'profile');
    if (profileNode) {
      profileNode.showOrgSwitcher = true;
      profileNode.subTitle = `Current Org.: ${user?.orgName}`;
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

  items.forEach((link, index) => {
    let menuItems = link.children || [];

    if (link.id === 'help') {
      link.children = [
        ...getFooterLinks(),
        {
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
          text: 'Switch organization',
          icon: 'arrow-random',
          onClick: toggleOrgSwitcher,
        },
      ];
    }
  });
  return items;
};

export const isLinkActive = (pathname: string, link: NavModelItem) => {
  // strip out any query params
  const linkPathname = link.url?.split('?')[0];
  const newNavigationEnabled = getConfig().featureToggles.newNavigation;
  if (linkPathname) {
    const dashboardLinkMatch = newNavigationEnabled ? '/dashboards' : '/';
    if (linkPathname === pathname) {
      // exact match
      return true;
    } else if (linkPathname !== '/' && pathname.startsWith(linkPathname)) {
      // partial match
      return true;
    } else if (linkPathname === '/alerting/list' && pathname.startsWith('/alerting/notification/')) {
      // alert channel match
      // TODO refactor routes such that we don't need this custom logic
      return true;
    } else if (linkPathname === dashboardLinkMatch && pathname.startsWith('/d/')) {
      // dashboard match
      // TODO refactor routes such that we don't need this custom logic
      return true;
    }
  }

  // child match
  if (link.children?.some((childLink) => isLinkActive(pathname, childLink))) {
    return true;
  }

  return false;
};

export const isSearchActive = (location: Location<unknown>) => {
  const query = new URLSearchParams(location.search);
  return query.get('search') === 'open';
};
