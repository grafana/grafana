import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../../utils/utils';

export const BASE_URL = getAPIBaseURL('playlist.grafana.app', 'v0alpha1');

export const api = createApi({
  reducerPath: 'playlistAPIv0alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
