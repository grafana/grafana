import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../utils/createBaseQuery';
import { getAPIBaseURL } from '../../../utils/utils';

export const BASE_URL = getAPIBaseURL('folder.grafana.app', 'v1beta1');

export const api = createApi({
  reducerPath: 'folderAPIv1beta1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
