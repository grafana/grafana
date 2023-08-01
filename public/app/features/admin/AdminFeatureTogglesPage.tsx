import { createApi, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import React from 'react';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

type FeatureToggle = {
  name: string;
  enabled: boolean;
  description: string;
};

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

export const { useGetFeatureTogglesQuery } = togglesApi;

export default function AdminFeatureTogglesPage() {
  const { data: featureToggles, isLoading, isError } = useGetFeatureTogglesQuery();

  const getErrorMessage = () => {
    return 'Error fetching feature toggles';
  };

  return (
    <Page navId="feature-toggles">
      <Page.Contents>
        <>
          {isError && getErrorMessage()}
          {isLoading && 'Fetching feature toggles'}
          {featureToggles && <AdminFeatureTogglesTable featureToggles={featureToggles} />}
        </>
      </Page.Contents>
    </Page>
  );
}
