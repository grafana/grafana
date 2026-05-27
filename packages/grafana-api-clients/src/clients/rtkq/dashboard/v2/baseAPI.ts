import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

const API_GROUP = 'dashboard.grafana.app' as const;
const API_VERSION = 'v2' as const;
const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'dashboardAPIv2',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
