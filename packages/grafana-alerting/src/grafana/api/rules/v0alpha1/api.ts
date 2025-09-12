import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL, getAPIReducerPath } from '../../util';

import { GROUP, VERSION } from './const';

const baseUrl = getAPIBaseURL(GROUP, VERSION);
const reducerPath = getAPIReducerPath(GROUP, VERSION);

export const api = createApi({
  reducerPath,
  baseQuery: fetchBaseQuery({
    // Set URL correctly so MSW can intercept requests
    // https://mswjs.io/docs/runbook#rtk-query-requests-are-not-intercepted
    baseUrl: new URL(baseUrl, globalThis.location.origin).href,
  }),
  endpoints: () => ({}),
});
