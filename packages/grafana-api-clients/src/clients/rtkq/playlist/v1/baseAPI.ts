import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { createApi } from '@reduxjs/toolkit/query/react';

import { isFetchError } from '@grafana/runtime';

import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery, type RequestOptions } from '../../createBaseQuery';

export const API_GROUP = 'playlist.grafana.app' as const;
export const API_VERSION = 'v1' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);
const BASE_URL_V0ALPHA1 = getAPIBaseURL(API_GROUP, 'v0alpha1');

/**
 * fall back to v0alpha1 if v1 is not implemented to provide backwards
 * compatibility.
 *
 * TODO: Remove this fallback logic after v1 is widely deployed (~March 2026)
 */
function createBaseQueryWithFallback(): BaseQueryFn<RequestOptions> {
  const v1BaseQuery = createBaseQuery({ baseURL: BASE_URL });
  const v0alpha1BaseQuery = createBaseQuery({ baseURL: BASE_URL_V0ALPHA1 });

  return async (args, api, extraOptions) => {
    const result = await v1BaseQuery(args, api, extraOptions);

    if (result.error && isFetchError(result.error) && result.error.status === 404) {
        return v0alpha1BaseQuery(args, api, extraOptions);
    }

    return result;
  };
}

export const api = createApi({
  reducerPath: 'playlistAPIv1',
  baseQuery: createBaseQueryWithFallback(),
  endpoints: () => ({}),
});
