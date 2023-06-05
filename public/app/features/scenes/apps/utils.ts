import { useLocation } from 'react-router-dom';

import { UrlQueryMap, urlUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';

export function useAppQueryParams() {
  const location = useLocation();
  return locationSearchToObject(location.search || '');
}

export function getLinkUrlWithAppUrlState(path: string, params: UrlQueryMap): string {
  return urlUtil.renderUrl(path, params);
}
