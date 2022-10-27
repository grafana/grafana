import { BaseQueryFn, createApi, retry } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state';

type ReqOptions = {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
};

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<BackendSrvRequest & ReqOptions> =>
  async (requestOptions) => {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseUrl + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
  };

const getConfigError = (err: { status: number }) => ({ error: err.status !== 404 ? err : null });

export const publicDashboardApi = createApi({
  reducerPath: 'publicDashboardApi',
  baseQuery: retry(backendSrvBaseQuery({ baseUrl: '/api/dashboards' }), { maxRetries: 3 }),
  tagTypes: ['Config'],
  keepUnusedDataFor: 0,
  endpoints: (builder) => ({
    getConfig: builder.query<PublicDashboard, string>({
      query: (dashboardUid) => ({
        url: `/uid/${dashboardUid}/public-config`,
        manageError: getConfigError,
        showErrorAlert: false,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (e) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const customError = e as { error: { data: { message: string } } };
          dispatch(notifyApp(createErrorNotification(customError?.error?.data?.message)));
        }
      },
      providesTags: ['Config'],
    }),
    saveConfig: builder.mutation<PublicDashboard, { dashboard: DashboardModel; payload: PublicDashboard }>({
      query: (params) => ({
        url: `/uid/${params.dashboard.uid}/public-config`,
        method: 'POST',
        data: params.payload,
      }),
      extraOptions: { maxRetries: 0 },
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
