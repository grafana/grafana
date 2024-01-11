import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';

import { createSuccessNotification } from '../../../core/copy/appNotification';
import { notifyApp } from '../../../core/reducers/appNotification';

export interface ChannelRS {
  id: string;
  name: string;
}

export interface Channel {
  value: string;
  label: string;
}

export interface SlackShareContent {
  dashboardUid: string;
  channelId: string;
  message?: string;
  imagePreviewUrl: string;
}

interface DashboardPreview {
  resourceUid: string; //dashboard uid or panel id
  resourceUrl: string; //dashboard url or panel url
}

const backendSrvBaseQuery =
  ({ baseUrl }: { baseUrl: string }): BaseQueryFn<BackendSrvRequest> =>
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
      return { error };
    }
  };

export const shareToSlackApi = createApi({
  reducerPath: 'shareToSlackApi',
  baseQuery: backendSrvBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['channels', 'preview'],
  endpoints: (builder) => ({
    getChannels: builder.query<Channel[], void>({
      query: () => ({
        url: `/share/slack/channels`,
      }),
      transformResponse: (response: ChannelRS[], meta, arg) => {
        return response.map((c) => ({ value: c.id, label: c.name }));
      },
      providesTags: (result, error, dashboardUid) => ['channels'],
    }),
    createPreview: builder.query<{ previewUrl: string }, DashboardPreview>({
      query: ({ resourceUrl }) => ({
        url: `/dashboards/preview`,
        method: 'POST',
        data: { resourceUrl },
      }),
      providesTags: (result, error, { resourceUid }) => [{ type: 'preview', id: resourceUid }],
    }),
    share: builder.mutation<
      void,
      {
        channelIds: string[];
        message?: string;
        imagePreviewUrl: string;
        dashboardUid: string;
        panelId?: string;
        dashboardPath: string;
      }
    >({
      query: (payload) => ({
        url: `/api/share/${payload.dashboardUid}/slack`,
        method: 'POST',
        data: payload,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        dispatch(notifyApp(createSuccessNotification('Shared to slack')));
      },
    }),
  }),
});

export const { useGetChannelsQuery, useCreatePreviewQuery, useShareMutation } = shareToSlackApi;
