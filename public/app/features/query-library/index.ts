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
import { queryLibraryApi } from './api/factory';
import { convertDataQueryResponseToQueryTemplates } from './api/mappers';
import { mockData } from './api/mocks';

export const {
  useAllQueryTemplatesQuery,
  useAddQueryTemplateMutation,
  // useDeleteQueryTemplateMutation,
  useEditQueryTemplateMutation,
} = queryLibraryApi;

export const { useDeleteQueryTemplateMutation, useListQueryTemplateQuery } = generatedQueryLibraryApi.enhanceEndpoints({
  endpoints: {
    // addQueryTemplate,
    // listQueryTemplate: {
    //   transformResponse: convertDataQueryResponseToQueryTemplates,
    // }
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
