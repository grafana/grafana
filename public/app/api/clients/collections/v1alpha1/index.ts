import { generatedAPI } from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { t } from '@grafana/i18n';
import { handleError } from 'app/api/utils';

// A star change reports its failure here, whoever made it. Confirming a stored change is left to the caller
export const collectionsAPIv1alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    addStar: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
        } catch (e) {
          handleError(e, dispatch, t('dashboard.toolbar.star-add-error', 'Failed to add to starred'));
        }
      },
    },
    removeStar: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
        } catch (e) {
          handleError(e, dispatch, t('dashboard.toolbar.star-remove-error', 'Failed to remove from starred'));
        }
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/collections/v1alpha1';
