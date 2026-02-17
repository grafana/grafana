import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

export const API_GROUP = 'dashboard.grafana.app' as const;
export const API_VERSION = 'v0alpha1' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'dashboardAPIv0alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
