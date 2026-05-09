import { generatedAPI } from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { t } from '@grafana/i18n';
import { handleError } from 'app/api/utils';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';

export const collectionsAPIv1alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    addStar: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification(t('dashboard.toolbar.star-added', 'Added to starred'))));
        } catch (e) {
          handleError(e, dispatch, t('dashboard.toolbar.star-add-error', 'Failed to add to starred'));
        }
      },
    },
    removeStar: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification(t('dashboard.toolbar.star-removed', 'Removed from starred'))));
        } catch (e) {
          handleError(e, dispatch, t('dashboard.toolbar.star-remove-error', 'Failed to remove from starred'));
        }
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/collections/v1alpha1';
