/**
 * This is a temporary place for Query Library API and data types.
 * To be exposed via grafana-runtime/data in the future.
 *
 * Query Library is an experimental feature, the API and components are subject to change
 *
 * @alpha
 */

import { config } from '@grafana/runtime';

import { generatedQueryLibraryApi } from './api/endpoints.gen';
import { QUERY_LIBRARY_GET_LIMIT } from './api/factory';
import { mockData } from './api/mocks';

export const {
  useCreateQueryTemplateMutation,
  useDeleteQueryTemplateMutation,
  useListQueryTemplateQuery,
  useUpdateQueryTemplateMutation,
} = generatedQueryLibraryApi.enhanceEndpoints({
  endpoints: {
    // Need to mutate the generated query to force query limit
    listQueryTemplate: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) =>
          originalQuery({
            ...requestOptions,
            limit: QUERY_LIBRARY_GET_LIMIT,
          });
      }
    },
    // Need to mutate the generated query to set the Content-Type header correctly
    updateQueryTemplate: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
        });
      }
    },
  },
});

export function isQueryLibraryEnabled() {
  return config.featureToggles.queryLibrary;
}

export const QueryLibraryMocks = {
  data: mockData.all,
};

export const IdentityServiceMocks = {
  data: mockData.identityDisplay,
};
