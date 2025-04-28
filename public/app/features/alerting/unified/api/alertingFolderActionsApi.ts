import { t } from 'app/core/internationalization';

import { WithNotificationOptions, alertingApi } from './alertingApi';
import { GRAFANA_RULER_CONFIG } from './featureDiscoveryApi';
import { rulerUrlBuilder } from './ruler';

export const alertingFolderActionsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    pauseFolder: build.mutation<
      void,
      {
        folderUID: string;
      }
    >({
      query: ({ folderUID }) => ({
        url: `/api/???`,
        method: 'POST',
        body: {
          folderUID,
        },
      }),
    }),
    unpauseFolder: build.mutation<
      void,
      {
        folderUID: string;
      }
    >({
      query: ({ folderUID }) => ({
        url: `/api/???`,
        method: 'POST',
        body: {
          folderUID,
        },
      }),
    }),
    deleteGrafanaRulesFromFolder: build.mutation<void, WithNotificationOptions<{ namespace: string }>>({
      query: ({ namespace, notificationOptions }) => {
        const successMessage = t('alerting.bulk-actions.delete.success', 'Successfully deleted rules in folder');
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
