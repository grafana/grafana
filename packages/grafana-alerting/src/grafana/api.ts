import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const BASE_URL = '/';

export const api = createApi({
  reducerPath: 'grafanaAlertingAPI',
  baseQuery: fetchBaseQuery({
    // Set URL correctly so MSW can intercept requests
    // https://mswjs.io/docs/runbook#rtk-query-requests-are-not-intercepted
    baseUrl: new URL(BASE_URL, location.origin).href,
  }),
  endpoints: () => ({}),
});
