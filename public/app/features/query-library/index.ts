/**
 * This is a temporary place for Query Library API and data types.
 * To be exposed via grafana-runtime/data in the future.
 */

import { queryLibraryApi } from './api/factory';
import { mockData } from './api/mocks';

export const { useAllQueryTemplatesQuery } = queryLibraryApi;

export const QueryLibraryMocks = {
  data: mockData,
};
