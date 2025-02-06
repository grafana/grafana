import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../api/createBaseQuery';
import { getAPIBaseURL } from '../../../api/utils';

export const BASE_URL = getAPIBaseURL('iam.grafana.app', 'v0alpha1');

export const iamApi = createApi({
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  reducerPath: 'iamAPI',
  endpoints: () => ({}),
});
