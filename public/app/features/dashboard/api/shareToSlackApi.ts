import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime/src';

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
  dashboardUid: string;
  dashboardUrl: string;
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
  refetchOnMountOrArgChange: true,
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
    createDashboardPreview: builder.query<{ previewUrl: string }, DashboardPreview>({
      query: ({ dashboardUrl }) => ({
        url: `/dashboards/preview`,
        method: 'POST',
        data: { dashboardUrl },
      }),
      providesTags: (result, error, { dashboardUid }) => [{ type: 'preview', id: dashboardUid }],
    }),
  }),
});

export const { useGetChannelsQuery, useCreateDashboardPreviewQuery } = shareToSlackApi;
