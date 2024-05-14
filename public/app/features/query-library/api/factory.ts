import { createApi } from '@reduxjs/toolkit/query/react';

import { QueryTemplate } from '../types';

import { convertDataQueryResponseToQueryTemplates } from './mappers';
import { baseQuery } from './query';

export const queryLibraryApi = createApi({
  baseQuery,
  endpoints: (builder) => ({
    allQueryTemplates: builder.query<QueryTemplate[], void>({
      query: () => undefined,
      transformResponse: convertDataQueryResponseToQueryTemplates,
    }),
  }),
  reducerPath: 'queryLibrary',
});
