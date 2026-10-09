import { type WithNotificationOptions, alertingApi } from './alertingApi';
import { GRAFANA_RULER_CONFIG } from './featureDiscoveryApi';
import { rulerUrlBuilder } from './ruler';

export type FolderPauseActionResponse = {
  message: string;
  updated?: number;
  skipped?: number;
};

export type FolderDeleteActionResponse = {
  message: string;
  deleted?: number;
  skipped?: number;
};

export const alertingFolderActionsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    pauseFolder: build.mutation<FolderPauseActionResponse, WithNotificationOptions<{ namespace: string }>>({
      query: ({ namespace, notificationOptions }) => {
        const { path, params } = rulerUrlBuilder(GRAFANA_RULER_CONFIG).namespace(namespace);

        return {
          url: path,
          params,
          body: {
            is_paused: true,
          },
          method: 'PATCH',
          notificationOptions: {
            ...notificationOptions,
            // The caller builds and shows its own toast from the response's `updated`/`skipped` counts, so
            // suppress backendSrv's default auto-toast (which would otherwise show the raw `message` field).
            // Applied last so a caller-supplied `showSuccessAlert` can never override the suppression.
            showSuccessAlert: false,
          },
        };
      },
    }),
    unpauseFolder: build.mutation<FolderPauseActionResponse, WithNotificationOptions<{ namespace: string }>>({
      query: ({ namespace, notificationOptions }) => {
        const { path, params } = rulerUrlBuilder(GRAFANA_RULER_CONFIG).namespace(namespace);

        return {
          url: path,
          params,
          body: {
            is_paused: false,
          },
          method: 'PATCH',
          notificationOptions: {
            ...notificationOptions,
            showSuccessAlert: false,
          },
        };
      },
    }),
    deleteGrafanaRulesFromFolder: build.mutation<
      FolderDeleteActionResponse,
      WithNotificationOptions<{ namespace: string }>
    >({
      query: ({ namespace, notificationOptions }) => {
        const { path, params } = rulerUrlBuilder(GRAFANA_RULER_CONFIG).namespace(namespace);

        return {
          url: path,
          params,
          method: 'DELETE',
          notificationOptions: {
            ...notificationOptions,
            showSuccessAlert: false,
          },
        };
      },
    }),
  }),
});
