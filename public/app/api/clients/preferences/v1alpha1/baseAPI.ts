import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

export const BASE_URL = getAPIBaseURL('preferences.grafana.app', 'v1alpha1');

export const api = createApi({
  reducerPath: 'preferencesAPIv1alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
