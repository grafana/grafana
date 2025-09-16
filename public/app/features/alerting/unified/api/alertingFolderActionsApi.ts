import { t } from '@grafana/i18n';

import { WithNotificationOptions, alertingApi } from './alertingApi';
import { GRAFANA_RULER_CONFIG } from './featureDiscoveryApi';
import { rulerUrlBuilder } from './ruler';

export const alertingFolderActionsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    pauseFolder: build.mutation<void, WithNotificationOptions<{ namespace: string }>>({
      query: ({ namespace, notificationOptions }) => {
        const successMessage = t(
          'alerting.bulk-actions.pause.success',
          'Rules evaluation successfully paused for folder'
        );
        const { path, params } = rulerUrlBuilder(GRAFANA_RULER_CONFIG).namespace(namespace);

        return {
          url: path,
          params,
          body: {
            is_paused: true,
          },
          method: 'PATCH',
          notificationOptions: {
            successMessage,
            ...notificationOptions,
          },
        };
      },
    }),
    unpauseFolder: build.mutation<void, WithNotificationOptions<{ namespace: string }>>({
      query: ({ namespace, notificationOptions }) => {
        const successMessage = t(
          'alerting.bulk-actions.unpause.success',
          'Rules successfully unpaused for this folder'
        );
        const { path, params } = rulerUrlBuilder(GRAFANA_RULER_CONFIG).namespace(namespace);

        return {
          url: path,
          params,
          body: {
            is_paused: false,
          },
          method: 'PATCH',
          notificationOptions: {
            successMessage,
            ...notificationOptions,
          },
        };
      },
    }),
    deleteGrafanaRulesFromFolder: build.mutation<void, WithNotificationOptions<{ namespace: string }>>({
      query: ({ namespace, notificationOptions }) => {
        const successMessage = t('alerting.bulk-actions.delete.success', 'Rules successfully deleted from folder');
        const { path, params } = rulerUrlBuilder(GRAFANA_RULER_CONFIG).namespace(namespace);

        return {
          url: path,
          params,
          method: 'DELETE',
          notificationOptions: {
            successMessage,
            ...notificationOptions,
          },
        };
      },
    }),
  }),
});
