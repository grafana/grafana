import { BaseQueryFn, createApi, retry } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state';

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

export const publicDashboardApi = createApi({
  reducerPath: 'publicDashboardApi',
  baseQuery: retry(backendSrvBaseQuery({ baseUrl: '/api/dashboards' }), { maxRetries: 3 }),
  tagTypes: ['Config'],
  keepUnusedDataFor: 0,
  endpoints: (builder) => ({
    getConfig: builder.query<PublicDashboard, string>({
      query: (dashboardUid) => ({
        url: `/uid/${dashboardUid}/public-config`,
      }),
      providesTags: ['Config'],
    }),
    saveConfig: builder.mutation<PublicDashboard, { dashboard: DashboardModel; payload: PublicDashboard }>({
      query: (params) => ({
        url: `/uid/${params.dashboard.uid}/public-config`,
        method: 'POST',
        data: params.payload,
      }),
      async onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));

        // Update runtime meta flag
        dashboard.updateMeta({
          publicDashboardUid: data.uid,
          publicDashboardEnabled: data.isEnabled,
        });
      },
      invalidatesTags: ['Config'],
    }),
  }),
});

export const { useGetConfigQuery, useSaveConfigMutation } = publicDashboardApi;
