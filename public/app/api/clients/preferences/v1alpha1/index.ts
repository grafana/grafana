import { t } from '@grafana/i18n';

import { notifyApp } from 'app/core/actions';
import { createSuccessNotification, createErrorNotification } from 'app/core/copy/appNotification';

import { generatedAPI } from './endpoints.gen';

export const preferencesAPIv1alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    addStar: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification(t('dashboard.toolbar.star-added', 'Added to starred'))));
        } catch (e) {
          if (e instanceof Error) {
            dispatch(
              notifyApp(createErrorNotification(t('dashboard.toolbar.star-add-error', 'Failed to add to starred'), e))
            );
          }
        }
      },
    },
    removeStar: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification(t('dashboard.toolbar.star-removed', 'Removed from starred'))));
        } catch (e) {
          if (e instanceof Error) {
            dispatch(
              notifyApp(
                createErrorNotification(t('dashboard.toolbar.star-remove-error', 'Failed to remove from starred'), e)
              )
            );
          }
        }
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from './endpoints.gen';
