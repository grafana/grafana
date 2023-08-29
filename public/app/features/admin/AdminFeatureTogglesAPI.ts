import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

type QueryArgs = {
  url: string;
  method?: string;
  body?: FeatureToggle[];
};

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<QueryArgs> =>
  async ({ url, method = 'GET', body }) => {
    try {
      const { data } = await lastValueFrom(
        getBackendSrv().fetch({
          url: baseUrl + url,
          method,
          data: body,
        })
      );
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
    updateFeatureToggles: builder.mutation<void, { featureToggles: FeatureToggle[] }>({
      query: (updatedToggles) => ({
        url: '/featuremgmt',
        method: 'POST',
        data: updatedToggles,
      }),
    }),
  }),
});

type FeatureToggle = {
  name: string;
  description?: string;
  enabled: boolean;
  readOnly?: boolean;
};

export const { useGetFeatureTogglesQuery, useUpdateFeatureTogglesMutation } = togglesApi;
export type { FeatureToggle };
