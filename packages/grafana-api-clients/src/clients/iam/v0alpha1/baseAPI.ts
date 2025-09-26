import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../../utils/utils';

export const BASE_URL = getAPIBaseURL('iam.grafana.app', 'v0alpha1');

export const api = createApi({
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  reducerPath: 'iamAPIv0alpha1',
  endpoints: () => ({}),
});
