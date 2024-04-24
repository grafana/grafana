import { ApiProvider } from '@reduxjs/toolkit/dist/query/react';
import React, { PropsWithChildren } from 'react';

import { createQueryLibraryApi } from './api/factory';

const api = createQueryLibraryApi();

export const { useAllQueryTemplatesQuery } = api;

export const QueryLibraryApiProvider = ({ children }: PropsWithChildren) => {
  return <ApiProvider api={api}>{children}</ApiProvider>;
};
