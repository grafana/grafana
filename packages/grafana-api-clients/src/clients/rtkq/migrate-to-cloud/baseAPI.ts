import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../createBaseQuery';

export const api = createApi({
  reducerPath: 'migrateToCloudGeneratedAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  endpoints: () => ({}),
});
