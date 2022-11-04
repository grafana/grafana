import { BaseQueryFn, createApi, retry } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state';
import { ListPublicDashboardResponse } from 'app/features/manage-dashboards/types';

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
  baseQuery: retry(backendSrvBaseQuery({ baseUrl: '/api/dashboards' }), { maxRetries: 0 }),
  tagTypes: ['PublicDashboard', 'AuditTablePublicDashboard'],
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getPublicDashboard: builder.query<PublicDashboard, string>({
      query: (dashboardUid) => ({
        url: `/uid/${dashboardUid}/public-dashboards`,
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
      providesTags: (result, error, dashboardUid) => [{ type: 'PublicDashboard', id: dashboardUid }],
    }),
    createPublicDashboard: builder.mutation<PublicDashboard, { dashboard: DashboardModel; payload: PublicDashboard }>({
      query: (params) => ({
        url: `/uid/${params.dashboard.uid}/public-dashboards`,
        method: 'POST',
        data: params.payload,
      }),
      async onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Public dashboard created!')));

        // Update runtime meta flag
        dashboard.updateMeta({
          hasPublicDashboard: true,
          publicDashboardUid: data.uid,
          publicDashboardEnabled: data.isEnabled,
        });
      },
      invalidatesTags: (result, error, { payload }) => [{ type: 'PublicDashboard', id: payload.dashboardUid }],
    }),
    updatePublicDashboard: builder.mutation<PublicDashboard, { dashboard: DashboardModel; payload: PublicDashboard }>({
      query: (params) => ({
        url: `/uid/${params.dashboard.uid}/public-dashboards/${params.payload.uid}`,
        method: 'PUT',
        data: params.payload,
      }),
      extraOptions: { maxRetries: 0 },
      async onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Public dashboard updated!')));

        // Update runtime meta flag
        dashboard.updateMeta({
          hasPublicDashboard: true,
          publicDashboardUid: data.uid,
          publicDashboardEnabled: data.isEnabled,
        });
      },
      invalidatesTags: (result, error, { payload }) => [{ type: 'PublicDashboard', id: payload.dashboardUid }],
    }),
    listPublicDashboards: builder.query<ListPublicDashboardResponse[], void>({
      query: () => ({
        url: '/public-dashboards',
      }),
      providesTags: ['AuditTablePublicDashboard'],
    }),
    deletePublicDashboard: builder.mutation<void, { dashboard?: DashboardModel; dashboardUid: string; uid: string }>({
      query: (params) => ({
        url: `/uid/${params.dashboardUid}/public-dashboards/${params.uid}`,
        method: 'DELETE',
      }),
      async onQueryStarted({ dashboard, uid }, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Public dashboard deleted!')));

        dashboard?.updateMeta({
          hasPublicDashboard: false,
          publicDashboardUid: uid,
          publicDashboardEnabled: false,
        });
      },
      invalidatesTags: (result, error, { dashboardUid }) => [
        { type: 'PublicDashboard', id: dashboardUid },
        'AuditTablePublicDashboard',
      ],
    }),
  }),
});

export const {
  useGetPublicDashboardQuery,
  useCreatePublicDashboardMutation,
  useUpdatePublicDashboardMutation,
  useDeletePublicDashboardMutation,
  useListPublicDashboardsQuery,
} = publicDashboardApi;
