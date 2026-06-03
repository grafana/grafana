import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '@grafana/api-clients';
import { createBaseQuery } from '@grafana/api-clients/rtkq';

import type { NotificationList } from './types';

const API_GROUP = 'notifications.grafana.app';
const API_VERSION = 'v0alpha1';

export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: createBaseQuery({
    baseURL: getAPIBaseURL(API_GROUP, API_VERSION),
  }),
  tagTypes: ['Notification' as const],
  endpoints: (build) => ({
    listNotifications: build.query<NotificationList, { limit?: number; continue?: string }>({
      query: ({ limit, continue: continueToken } = {}) => {
        const params = new URLSearchParams();
        if (limit !== undefined) {
          params.set('limit', String(limit));
        }
        if (continueToken) {
          params.set('continue', continueToken);
        }
        const qs = params.toString();
        return { url: `/notifications${qs ? `?${qs}` : ''}`, method: 'GET' };
      },
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
    deleteNotification: build.mutation<void, { name: string }>({
      query: ({ name }) => ({ url: `/notifications/${name}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const { useListNotificationsQuery, useDeleteNotificationMutation } = notificationsApi;
