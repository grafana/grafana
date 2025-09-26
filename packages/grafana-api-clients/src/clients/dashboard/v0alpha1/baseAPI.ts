import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../../utils/utils';

export const BASE_URL = getAPIBaseURL('dashboard.grafana.app', 'v0alpha1');

export const api = createApi({
  reducerPath: 'dashboardAPIv0alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
