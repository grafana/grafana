import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<{ url: string }> =>
  async ({ url }) => {
    try {
      const { data } = await lastValueFrom(getBackendSrv().fetch({ url: baseUrl + url }));
      return { data };
    } catch (error) {
      return { error };
    }
  };

export const togglesApi = createApi({
  reducerPath: 'togglesApi',
  baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getFeatureToggles: builder.query<FeatureToggle[], void>({
      query: () => ({ url: '/featuremgmt' }),
    }),
  }),
});

type FeatureToggle = {
  name: string;
  enabled: boolean;
  description: string;
};

export const { useGetFeatureTogglesQuery } = togglesApi;
export type { FeatureToggle };
