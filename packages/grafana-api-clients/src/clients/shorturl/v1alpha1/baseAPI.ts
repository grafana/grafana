import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../../utils/utils';

export const BASE_URL = getAPIBaseURL('shorturl.grafana.app', 'v1alpha1');

export const api = createApi({
  reducerPath: 'shortURLAPIv1alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
