import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

export const BASE_URL = getAPIBaseURL('playlist.grafana.app', 'v0alpha1');

export const api = createApi({
  reducerPath: 'playlistAPI',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
