import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboardUtils';

export const pubDashApi = createApi({
  reducerPath: 'pubDashApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/dashboards' }),
  endpoints: (builder) => ({
    getConfig: builder.query<PublicDashboard, string>({
      query: (dashboardUid) => `/uid/${dashboardUid}/public-config`,
    }),
  }),
});

export const { useGetConfigQuery } = pubDashApi;
