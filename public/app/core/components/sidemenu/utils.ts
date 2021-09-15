import { NavModelItem } from '@grafana/data';
import { getConfig } from 'app/core/config';
import { UserPreferencesDTO } from 'app/types';
import { Location } from 'history';

export const getForcedLoginUrl = (url: string) => {
  const queryParams = new URLSearchParams(url.split('?')[1]);
  queryParams.append('forceLogin', 'true');

  return `${getConfig().appSubUrl}${url.split('?')[0]}?${queryParams.toString()}`;
};

export const getOppositePosition = (position: Exclude<UserPreferencesDTO['navPosition'], ''>) => {
  switch (position) {
    case 'left': {
      return 'right';
    }
    case 'right': {
      return 'left';
    }
    case 'top': {
      return 'bottom';
    }
    case 'bottom': {
      return 'top';
    }
    default: {
      return 'right';
    }
  }
};

export const isHorizontal = (navPosition: Exclude<UserPreferencesDTO['navPosition'], ''>) => {
  return navPosition === 'top' || navPosition === 'bottom';
};

export const isLinkActive = (pathname: string, link: NavModelItem) => {
  // strip out any query params
  const linkPathname = link.url?.split('?')[0];
  if (linkPathname) {
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
    } else if (linkPathname === '/' && pathname.startsWith('/d/')) {
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
