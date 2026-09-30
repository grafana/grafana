import { useLocation } from 'react-router-dom-v5-compat';

import { type UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';

export type UseUrlParamsResult = [URLSearchParams, (params: UrlQueryMap, replace?: boolean) => void];

/** @internal experimental */
export function useUrlParams(): UseUrlParamsResult {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const updateUrlParams = (params: UrlQueryMap, replace?: boolean) => {
    // Should find a way to use history directly here
    locationService.partial(params, replace);
  };

  return [params, updateUrlParams];
}
