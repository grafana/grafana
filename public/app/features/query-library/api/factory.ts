import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../api/createBaseQuery';

import { BASE_URL } from './query';

// Currently, we are loading all query templates
// Organizations can have maximum of 1000 query templates
export const QUERY_LIBRARY_GET_LIMIT = 1000;

export const queryLibraryApi = createApi({
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  endpoints: () => ({}),
});
