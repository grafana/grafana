import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients';

export const baseAPI = createApi({
  reducerPath: 'userPreferencesAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  endpoints: () => ({}),
});
