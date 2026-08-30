import { generatedAPI } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { t } from '@grafana/i18n';
import { handleError } from 'app/api/utils';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';

export const correlationsAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    createCorrelation: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }
      endpointDefinition.query = (requestOptions) => {
        // Ensure metadata exists
        if (!requestOptions.correlation.metadata) {
          requestOptions.correlation.metadata = {};
        }
        const metadata = requestOptions.correlation.metadata;
        if (!metadata.name && !metadata.generateName) {
          // GenerateName lets the apiserver create a new uid for the name
          metadata.generateName = 'c';
        }
        return originalQuery(requestOptions);
      };

      endpointDefinition.onQueryStarted = async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;

          dispatch(
            notifyApp(createSuccessNotification(t('correlations.notify.create-success', 'Correlation created')))
          );
        } catch (e) {
          handleError(e, dispatch, t('correlations.notify.create-error', 'Error creating correlation'));
        }
      };
    },
    updateCorrelation: {
      onQueryStarted: async ({}, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;

          dispatch(notifyApp(createSuccessNotification(t('correlations.notify.edit-success', 'Correlation updated'))));
        } catch (e) {
          handleError(e, dispatch, t('correlations.notify.edit-error', 'Error updating correlation'));
        }
      },
    },
    deleteCorrelation: {
      onQueryStarted: async ({}, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;

          dispatch(
            notifyApp(createSuccessNotification(t('correlations.notify.delete-success', 'Correlation deleted')))
          );
        } catch (e) {
          handleError(e, dispatch, t('correlations.notify.delete-error', 'Error deleting correlation'));
        }
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/correlations/v0alpha1';
