import { createApi } from '@reduxjs/toolkit/query/react';

import { t } from '@grafana/i18n';
import { config, FetchError, isFetchError } from '@grafana/runtime';
import { createBaseQuery } from 'app/api/createBaseQuery';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import {
  PublicDashboard,
  PublicDashboardSettings,
  PublicDashboardShareType,
  SessionDashboard,
  SessionUser,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import {
  PublicDashboardListWithPagination,
  PublicDashboardListWithPaginationResponse,
} from 'app/features/manage-dashboards/types';

function isFetchBaseQueryError(error: unknown): error is { error: FetchError } {
  return typeof error === 'object' && error != null && 'error' in error;
}

export const getConfigError = (err: unknown) => ({
  error: isFetchError(err) && err.data.messageId !== 'publicdashboards.notFound' ? err : null,
});

export const publicDashboardApi = createApi({
  reducerPath: 'publicDashboardApi',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  tagTypes: ['PublicDashboard', 'AuditTablePublicDashboard', 'UsersWithActiveSessions', 'ActiveUserDashboards'],
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
          if (isFetchBaseQueryError(e) && isFetchError(e.error) && config.publicDashboardsEnabled) {
            dispatch(notifyApp(createErrorNotification(e.error.data.message)));
          }
        }
      },
      providesTags: (result, error, dashboardUid) => [{ type: 'PublicDashboard', id: dashboardUid }],
    }),
    createPublicDashboard: builder.mutation<
      PublicDashboard,
      { dashboard: DashboardModel | DashboardScene; payload: Partial<PublicDashboardSettings> }
    >({
      query: (params) => {
        const dashUid = params.dashboard instanceof DashboardScene ? params.dashboard.state.uid : params.dashboard.uid;
        return {
          url: `/dashboards/uid/${dashUid}/public-dashboards`,
          method: 'POST',
          body: params.payload,
        };
      },
      async onQueryStarted({ dashboard, payload: { share } }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        const message =
          share === PublicDashboardShareType.PUBLIC
            ? t('public-dashboard.public-sharing.success-creation', 'Your dashboard is now publicly accessible')
            : t('public-dashboard.email-sharing.success-creation', 'Your dashboard is ready for external sharing');
        dispatch(notifyApp(createSuccessNotification(message)));

        if (dashboard instanceof DashboardScene) {
          dashboard.setState({
            meta: { ...dashboard.state.meta, publicDashboardEnabled: data.isEnabled },
          });
        } else {
          dashboard.updateMeta({
            publicDashboardEnabled: data.isEnabled,
          });
        }
      },
      invalidatesTags: (result, error, { dashboard }) => [
        { type: 'PublicDashboard', id: dashboard instanceof DashboardScene ? dashboard.state.uid : dashboard.uid },
      ],
    }),
    updatePublicDashboard: builder.mutation<
      PublicDashboard,
      {
        dashboard: (Pick<DashboardModel, 'uid'> & Partial<Pick<DashboardModel, 'updateMeta'>>) | DashboardScene;
        payload: Partial<PublicDashboard>;
      }
    >({
      query: ({ payload, dashboard }) => {
        const dashUid = dashboard instanceof DashboardScene ? dashboard.state.uid : dashboard.uid;
        return {
          url: `/dashboards/uid/${dashUid}/public-dashboards/${payload.uid}`,
          method: 'PATCH',
          body: payload,
        };
      },
      async onQueryStarted({ dashboard }, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(
          notifyApp(
            createSuccessNotification(
              t('public-dashboard.configuration.success-update', 'Settings have been successfully updated')
            )
          )
        );
      },
      invalidatesTags: (result, error, { payload }) => [
        { type: 'PublicDashboard', id: payload.dashboardUid },
        'AuditTablePublicDashboard',
      ],
    }),
    pauseOrResumePublicDashboard: builder.mutation<
      PublicDashboard,
      {
        dashboard: (Pick<DashboardModel, 'uid'> & Partial<Pick<DashboardModel, 'updateMeta'>>) | DashboardScene;
        payload: Partial<PublicDashboard>;
      }
    >({
      query: ({ payload, dashboard }) => {
        const dashUid = dashboard instanceof DashboardScene ? dashboard.state.uid : dashboard.uid;
        return {
          url: `/dashboards/uid/${dashUid}/public-dashboards/${payload.uid}`,
          method: 'PATCH',
          body: payload,
        };
      },
      async onQueryStarted({ dashboard, payload: { isEnabled } }, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        const message = isEnabled
          ? t('public-dashboard.configuration.success-resume', 'Your dashboard access has been resumed')
          : t('public-dashboard.configuration.success-pause', 'Your dashboard access has been paused');
        dispatch(notifyApp(createSuccessNotification(message)));

        if (dashboard instanceof DashboardScene) {
          dashboard.setState({
            meta: { ...dashboard.state.meta, publicDashboardEnabled: data.isEnabled },
          });
        } else {
          dashboard.updateMeta?.({
            publicDashboardEnabled: data.isEnabled,
          });
        }
      },
      invalidatesTags: (result, error, { payload }) => [
        { type: 'PublicDashboard', id: payload.dashboardUid },
        'AuditTablePublicDashboard',
      ],
    }),
    updatePublicDashboardAccess: builder.mutation<
      PublicDashboard,
      {
        dashboard: (Pick<DashboardModel, 'uid'> & Partial<Pick<DashboardModel, 'updateMeta'>>) | DashboardScene;
        payload: Partial<PublicDashboard>;
      }
    >({
      query: ({ payload, dashboard }) => {
        const dashUid = dashboard instanceof DashboardScene ? dashboard.state.uid : dashboard.uid;
        return {
          url: `/dashboards/uid/${dashUid}/public-dashboards/${payload.uid}`,
          method: 'PATCH',
          body: payload,
        };
      },
      async onQueryStarted({ dashboard, payload: { share } }, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        const message =
          share === PublicDashboardShareType.PUBLIC
            ? t(
                'public-dashboard.public-sharing.success-share-type-change',
                'Dashboard access updated: Anyone with the link can now access'
              )
            : t(
                'public-dashboard.email-sharing.success-share-type-change',
                'Dashboard access updated: Only specific people can now access with the link'
              );
        dispatch(notifyApp(createSuccessNotification(message)));
      },
      invalidatesTags: (result, error, { payload }) => [
        { type: 'PublicDashboard', id: payload.dashboardUid },
        'AuditTablePublicDashboard',
      ],
    }),
    addRecipient: builder.mutation<void, { recipient: string; dashboardUid: string; uid: string }>({
      query: () => ({
        url: '',
      }),
    }),
    deleteRecipient: builder.mutation<
      void,
      { recipientUid: string; recipientEmail: string; dashboardUid: string; uid: string }
    >({
      query: () => ({
        url: '',
      }),
    }),
    reshareAccessToRecipient: builder.mutation<void, { recipientUid: string; uid: string }>({
      query: () => ({
        url: '',
      }),
    }),
    getActiveUsers: builder.query<SessionUser[], void>({
      query: () => ({
        url: '/',
      }),
      providesTags: ['UsersWithActiveSessions'],
    }),
    getActiveUserDashboards: builder.query<SessionDashboard[], string>({
      query: () => ({
        url: '',
      }),
      providesTags: (result, _, email) => [{ type: 'ActiveUserDashboards', id: email }],
    }),
    listPublicDashboards: builder.query<PublicDashboardListWithPagination, number | void>({
      query: (page = 1) => ({
        url: `/dashboards/public-dashboards?page=${page}&perpage=8`,
      }),
      transformResponse: (response: PublicDashboardListWithPaginationResponse) => ({
        ...response,
        totalPages: Math.ceil(response.totalCount / response.perPage),
      }),
      providesTags: ['AuditTablePublicDashboard'],
    }),
    deletePublicDashboard: builder.mutation<
      void,
      { dashboard?: DashboardModel | DashboardScene; dashboardUid: string; uid: string }
    >({
      query: (params) => ({
        url: `/dashboards/uid/${params.dashboardUid}/public-dashboards/${params.uid}`,
        method: 'DELETE',
      }),
      async onQueryStarted({ dashboard }, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(
          notifyApp(
            createSuccessNotification(
              t('public-dashboard.share.success-delete', 'Your dashboard is no longer shareable')
            )
          )
        );
        dispatch(publicDashboardApi.util?.resetApiState());

        if (dashboard instanceof DashboardScene) {
          dashboard.setState({
            meta: { ...dashboard.state.meta, publicDashboardEnabled: false },
          });
        } else {
          dashboard?.updateMeta({
            publicDashboardEnabled: false,
          });
        }
      },
      invalidatesTags: (result, error, { dashboardUid }) => [
        { type: 'PublicDashboard', id: dashboardUid },
        'AuditTablePublicDashboard',
        'UsersWithActiveSessions',
        'ActiveUserDashboards',
      ],
    }),
    revokeAllAccess: builder.mutation<void, { email: string }>({
      query: () => ({
        url: '',
      }),
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
  useGetActiveUsersQuery,
  useGetActiveUserDashboardsQuery,
  useRevokeAllAccessMutation,
  usePauseOrResumePublicDashboardMutation,
  useUpdatePublicDashboardAccessMutation,
} = publicDashboardApi;
