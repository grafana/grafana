import { NavModelItem } from '@grafana/data';
import { getConfig } from 'app/core/config';
import { Location } from 'history';

export const getForcedLoginUrl = (url: string) => {
  const queryParams = new URLSearchParams(url.split('?')[1]);
  queryParams.append('forceLogin', 'true');

  return `${getConfig().appSubUrl}${url.split('?')[0]}?${queryParams.toString()}`;
};

export const isLinkActive = (pathname: string, link: NavModelItem) => {
  if (link.url === pathname) {
    // exact match
    return true;
  } else if (link.url && link.url !== '/' && pathname.startsWith(link.url)) {
    // partial match
    if (pathname === '/dashboards/folder/new') {
      // ignore this partial match since there is already an exact match under the '+' route
      // TODO remove this ignore once the '+' button is moved under the dashboard link
      return false;
    }
    return true;
  } else if (link.url === '/alerting/list' && pathname.startsWith('/alerting/notification/')) {
    // alert channel match
    // TODO refactor routes such that we don't need this custom logic
    return true;
  } else if (link.url === '/' && pathname.startsWith('/d/')) {
    // dashboard match
    // TODO refactor routes such that we don't need this custom logic
    return true;
  } else if (link.children?.some((childLink) => isLinkActive(pathname, childLink))) {
    // child match
    return true;
  }
  return false;
};

export const isSearchActive = (location: Location<unknown>) => {
  const query = new URLSearchParams(location.search);
  return query.get('search') === 'open';
};
