import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, FetchError, getBackendSrv, isFetchError } from '@grafana/runtime/src';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';

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

export const shareToSlackApi = createApi({
  reducerPath: 'shareToSlackApi',
  baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['channels', 'preview'],
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getChannels: builder.query<string[] | undefined, string>({
      query: (dashboardUid) => ({
        url: `/share/slack/channels`,
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
      providesTags: (result, error, dashboardUid) => ['channels'],
    }),
    createDashboardPreview: builder.query<string[] | undefined, string>({
      query: (dashboardUid) => ({
        url: `/dashboards/${dashboardUid}/preview`,
        method: 'POST',
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
      providesTags: (result, error, dashboardUid) => [{ type: 'preview', id: dashboardUid }],
    }),
  }),
});

export const { useGetChannelsQuery, useCreateDashboardPreviewQuery } = shareToSlackApi;
