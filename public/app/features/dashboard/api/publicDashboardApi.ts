import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, FetchError, getBackendSrv, isFetchError } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import {
  PublicDashboard,
  PublicDashboardSettings,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state';
import { ListPublicDashboardResponse } from 'app/features/manage-dashboards/types';

type ReqOptions = {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
};

function isFetchBaseQueryError(error: unknown): error is { error: FetchError } {
  return typeof error === 'object' && error != null && 'error' in error;
}

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

const getConfigError = (err: unknown) => ({ error: isFetchError(err) && err.status !== 404 ? err : null });

export const publicDashboardApi = createApi({
  reducerPath: 'publicDashboardApi',
  baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['PublicDashboard', 'AuditTablePublicDashboard', 'UsersWithActiveSessions'],
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getPublicDashboard: builder.query<PublicDashboard | undefined, string>({
      query: (dashboardUid) => ({
        url: `/dashboards/uid/${dashboardUid}/public-dashboards`,
        manageError: getConfigError,
        showErrorAlert: false,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification(e.error.data.message)));
          }
        }
      },
      providesTags: (result, error, dashboardUid) => [{ type: 'PublicDashboard', id: dashboardUid }],
    }),
    createPublicDashboard: builder.mutation<
      PublicDashboard,
      { dashboard: DashboardModel; payload: Partial<PublicDashboardSettings> }
    >({
      query: (params) => ({
        url: `/dashboards/uid/${params.dashboard.uid}/public-dashboards`,
        method: 'POST',
        data: params.payload,
      }),
      async onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Dashboard is public!')));

        // Update runtime meta flag
        dashboard.updateMeta({
          publicDashboardUid: data.uid,
          publicDashboardEnabled: data.isEnabled,
        });
      },
      invalidatesTags: (result, error, { dashboard }) => [{ type: 'PublicDashboard', id: dashboard.uid }],
    }),
    updatePublicDashboard: builder.mutation<PublicDashboard, { dashboard: DashboardModel; payload: PublicDashboard }>({
      query: (params) => ({
        url: `/dashboards/uid/${params.dashboard.uid}/public-dashboards/${params.payload.uid}`,
        method: 'PUT',
        data: params.payload,
      }),
      async onQueryStarted({ dashboard, payload }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Public dashboard updated!')));

        // Update runtime meta flag
        dashboard.updateMeta({
          publicDashboardUid: data.uid,
          publicDashboardEnabled: data.isEnabled,
        });
      },
      invalidatesTags: (result, error, { payload }) => [{ type: 'PublicDashboard', id: payload.dashboardUid }],
    }),
    addRecipient: builder.mutation<void, { recipient: string; dashboardUid: string; uid: string }>({
      query: () => ({
        url: '',
      }),
    }),
    deleteRecipient: builder.mutation<void, { recipientUid: string; dashboardUid: string; uid: string }>({
      query: () => ({
        url: '',
      }),
    }),
    reshareAccessToRecipient: builder.mutation<void, { recipientUid: string; uid: string }>({
      query: () => ({
        url: '',
      }),
    }),
    getUsersWithActiveSessions: builder.query<string[], void>({
      query: () => ({
        url: '/',
      }),
      providesTags: ['UsersWithActiveSessions'],
    }),
    listPublicDashboards: builder.query<ListPublicDashboardResponse[], void>({
      query: () => ({
        url: '/dashboards/public-dashboards',
      }),
      providesTags: ['AuditTablePublicDashboard'],
    }),
    deletePublicDashboard: builder.mutation<void, { dashboard?: DashboardModel; dashboardUid: string; uid: string }>({
      query: (params) => ({
        url: `/dashboards/uid/${params.dashboardUid}/public-dashboards/${params.uid}`,
        method: 'DELETE',
      }),
      async onQueryStarted({ dashboard, uid }, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Public dashboard deleted!')));

        dashboard?.updateMeta({
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
  useAddRecipientMutation,
  useDeleteRecipientMutation,
  useReshareAccessToRecipientMutation,
  useGetUsersWithActiveSessionsQuery,
} = publicDashboardApi;
