import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';

export const legacyUserAPI = createApi({
  reducerPath: 'legacyUserAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  tagTypes: ['dashboardStars'],
  endpoints: (build) => ({
    getStars: build.query<string[], void>({
      query: () => ({ url: '/user/stars' }),
      providesTags: ['dashboardStars'],
    }),
    starDashboard: build.mutation<void, { id: string }>({
      query: ({ id }) => ({ url: `/user/stars/dashboard/uid/${id}`, method: 'POST' }),
      invalidatesTags: ['dashboardStars'],
    }),
    unstarDashboard: build.mutation<void, { id: string }>({
      query: ({ id }) => ({ url: `/user/stars/dashboard/uid/${id}`, method: 'DELETE' }),
      invalidatesTags: ['dashboardStars'],
    }),
  }),
});

export const { useGetStarsQuery, useStarDashboardMutation, useUnstarDashboardMutation } = legacyUserAPI;
