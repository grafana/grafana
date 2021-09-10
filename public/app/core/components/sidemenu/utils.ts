import { NavModelItem } from '@grafana/data';
import { getConfig } from 'app/core/config';
import { Location } from 'history';

export const getForcedLoginUrl = (url: string) => {
  const queryParams = new URLSearchParams(url.split('?')[1]);
  queryParams.append('forceLogin', 'true');

  return `${getConfig().appSubUrl}${url.split('?')[0]}?${queryParams.toString()}`;
};

export const isLinkActive = (pathname: string, link: NavModelItem) => {
  return Boolean(
    link.url === pathname ||
      (link.url && link.url !== '/' && pathname.startsWith(link.url)) ||
      link.children?.some((childLink) => childLink.url && childLink.url !== '/' && pathname.startsWith(childLink.url))
  );
};

export const isSearchActive = (location: Location<unknown>) => {
  const query = new URLSearchParams(location.search);
  return query.get('search') === 'open';
};
