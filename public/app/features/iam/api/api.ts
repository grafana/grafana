import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from './query';

export const iamApi = createApi({
  baseQuery,
  reducerPath: 'iamAPI',
  endpoints: () => ({}),
});
