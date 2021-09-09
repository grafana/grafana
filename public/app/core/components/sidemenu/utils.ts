import { NavModelItem } from '@grafana/data';
import { getConfig } from 'app/core/config';

export const getForcedLoginUrl = (url: string) => {
  const queryParams = new URLSearchParams(url.split('?')[1]);
  queryParams.append('forceLogin', 'true');

  return `${getConfig().appSubUrl}${url.split('?')[0]}?${queryParams.toString()}`;
};

export const linkIsActive = (pathname: string, link: NavModelItem) => {
  return Boolean(link.url === pathname || link.children?.some((childLink) => childLink.url === pathname));
};
