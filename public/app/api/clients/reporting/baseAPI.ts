import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../createBaseQuery';

export const BASE_URL = '/api/reports';

export const reportingAPI = createApi({
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  reducerPath: 'reportingAPI',
  endpoints: () => ({}),
});
