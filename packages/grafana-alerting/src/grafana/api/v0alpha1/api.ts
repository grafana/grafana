import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL, getAPIReducerPath } from '../util';

const VERSION = 'v0alpha1';
const GROUP = 'notifications.alerting.grafana.app';

const baseUrl = getAPIBaseURL(GROUP, VERSION);
const reducerPath = getAPIReducerPath(GROUP, VERSION);

export const api = createApi({
  reducerPath,
  baseQuery: fetchBaseQuery({
    baseUrl,
  }),
  endpoints: () => ({}),
});
