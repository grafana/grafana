import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../utils/createBaseQuery';

export const api = createApi({
  reducerPath: 'legacyUserAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  endpoints: () => ({}),
});
