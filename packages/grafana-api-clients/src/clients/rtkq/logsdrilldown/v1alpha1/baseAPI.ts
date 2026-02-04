import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

export const API_GROUP = 'logsdrilldown.grafana.app' as const;
export const API_VERSION = 'v1alpha1' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: 'logsdrilldownAPIv1alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
