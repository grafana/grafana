import { createApi } from '@reduxjs/toolkit/query/react';

import { QueryTemplate } from '@grafana/data';

import { convertDataQueryResponseToQueryTemplates } from './mappers';
import { baseQuery } from './query';

export const createQueryLibraryApi = () => {
  return createApi({
    baseQuery,
    endpoints: (builder) => ({
      allQueryTemplates: builder.query<QueryTemplate[], void>({
        query: () => undefined,
        transformResponse: convertDataQueryResponseToQueryTemplates,
      }),
    }),
    reducerPath: undefined,
  });
};
