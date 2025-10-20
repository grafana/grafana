import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../../../utils/utils';

export const API_GROUP = 'correlations.grafana.app' as const;
export const API_VERSION = 'v0alpha1' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'correlationsAPIv0alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
