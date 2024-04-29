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
