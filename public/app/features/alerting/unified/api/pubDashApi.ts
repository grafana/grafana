import { BaseQueryFn, createApi, retry } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string } = { baseUrl: '' }): BaseQueryFn<BackendSrvRequest> =>
  async (requestOptions) => {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({ ...requestOptions, url: baseUrl + requestOptions.url })
      );
      return { data: responseData, meta };
    } catch (error) {
      return { error };
    }
  };

export const pubDashApi = createApi({
  reducerPath: 'pubDashApi',
  baseQuery: retry(backendSrvBaseQuery({ baseUrl: '/api/dashboards' })),
  tagTypes: ['Config'],
  keepUnusedDataFor: 0,
  refetchOnFocus: true,
  endpoints: (builder) => ({
    getPubDashConfig: builder.query<PublicDashboard, string>({
      query: (dashboardUid) => ({
        url: `/uid/${dashboardUid}/public-config`,
      }),
      providesTags: ['Config'],
    }),
    savePubDashConfig: builder.mutation<PublicDashboard, string>({
      query: (dashboardUid) => ({
        url: `/uid/${dashboardUid}/public-consfig`,
        method: 'POST',
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
      },
      invalidatesTags: ['Config'],
    }),
  }),
});

export const { useGetPubDashConfigQuery, useSavePubDashConfigMutation } = pubDashApi;
