import { generatedAPI } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { t } from '@grafana/i18n';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
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
    },
    updateCorrelation: {
      onQueryStarted: async ({}, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;

          dispatch(notifyApp(createSuccessNotification(t('correlation.edit-success', 'Correlation updated'))));
        } catch (e) {
          if (e instanceof Error) {
            dispatch(notifyApp(createErrorNotification(t('correlation.edit-error', 'Error updating correlation'), e)));
          }
        }
      },
    },
  },
});

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/correlations/v0alpha1';
