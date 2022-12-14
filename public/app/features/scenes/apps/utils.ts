import { useLocation } from 'react-router-dom';

import { UrlQueryMap, urlUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';

export function useAppQueryParams() {
  const location = useLocation();
  return locationSearchToObject(location.search || '');
}

export function getLinkUrlWithAppUrlState(path: string, params: UrlQueryMap): string {
  return urlUtil.renderUrl(path, {
    from: params.from,
    to: params.to,
    'var-instance': params['var-instance'],
  });
}
