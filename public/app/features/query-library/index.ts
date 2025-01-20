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
import { mockData } from './api/mocks';

export const {
  // useAllQueryTemplatesQuery,
  // useAddQueryTemplateMutation,
  // useDeleteQueryTemplateMutation,
  useEditQueryTemplateMutation,
} = queryLibraryApi;

export const { useCreateQueryTemplateMutation, useDeleteQueryTemplateMutation, useListQueryTemplateQuery } =
  generatedQueryLibraryApi.enhanceEndpoints({
    endpoints: {
      // listQueryTemplate: {
      //   transformResponse: (response) => response.data,
      // }
    },
  });

// TODO probably remove
export function withNamespace<T extends (...args: any[]) => any>(queryMethod: T) {
  return (args: Omit<Parameters<T>[0], 'namespace'>) =>
    queryMethod({
      namespace: config.namespace,
      ...args,
    });
}

export function isQueryLibraryEnabled() {
  return config.featureToggles.queryLibrary;
}

export const QueryLibraryMocks = {
  data: mockData.all,
};

export const IdentityServiceMocks = {
  data: mockData.identityDisplay,
};
