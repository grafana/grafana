/**
 * This is a temporary place for Query Library API and data types.
 * To be exposed via grafana-runtime/data in the future.
 */

export { QueryTemplate } from './types';

import { ApiProvider } from '@reduxjs/toolkit/query/react';
import React, { PropsWithChildren } from 'react';

import { createQueryLibraryApi } from './api/factory';
import { mockData } from './api/mocks';

const api = createQueryLibraryApi();

export const { useAllQueryTemplatesQuery } = api;

export const QueryLibraryApiProvider = ({ children }: PropsWithChildren) => {
  return <ApiProvider api={api}>{children}</ApiProvider>;
};

export const QueryLibraryMocks = {
  data: mockData,
};
