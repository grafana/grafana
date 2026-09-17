import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '@grafana/api-clients';
import { createBaseQuery } from '@grafana/api-clients/rtkq';

const API_GROUP = 'scope.grafana.app' as const;
const API_VERSION = 'v0alpha1' as const;
const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'scopeAPIv0alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
