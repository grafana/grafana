import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL, resolveAPIBaseURLWithFallback } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

export const API_GROUP = 'folder.grafana.app' as const;
export const API_VERSION = 'v1beta1' as const;
export const COMPATIBLE_VERSIONS = [API_VERSION, 'v1'] as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'folderAPIv1beta1',
  baseQuery: createBaseQuery({
    getBaseURL: () => resolveAPIBaseURLWithFallback(API_GROUP, COMPATIBLE_VERSIONS, BASE_URL),
  }),
  endpoints: () => ({}),
});
