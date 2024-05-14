/**
 * This is a temporary place for Query Library API and data types.
 * To be exposed via grafana-runtime/data in the future.
 *
 * Query Library is an experimental feature, the API and components are subject to change
 *
 * @alpha
 */

import { queryLibraryApi } from './api/factory';
import { mockData } from './api/mocks';

export const { useAllQueryTemplatesQuery } = queryLibraryApi;

export const QueryLibraryMocks = {
  data: mockData,
};
