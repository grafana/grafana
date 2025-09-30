import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients';

export const api = createApi({
  reducerPath: 'migrateToCloudGeneratedAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  endpoints: () => ({}),
});
