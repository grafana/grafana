import { PluginMeta } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const pluginsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getPluginSettings: build.query<PluginMeta, string>({
      query: (pluginId) => ({
        url: `/api/plugins/${pluginId}/settings`,
        notificationOptions: {
          showErrorAlert: false,
        },
      }),
      // Keep plugin settings cached for the entire session
      keepUnusedDataFor: 3600, // 1 hour in seconds
    }),
  }),
});

export const { useGetPluginSettingsQuery } = pluginsApi;
