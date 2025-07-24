import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

export const BASE_URL = getAPIBaseURL('iam.grafana.app', 'v0alpha1');

export const api = createApi({
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  reducerPath: 'iamAPIv0alpha1',
  endpoints: () => ({}),
});
