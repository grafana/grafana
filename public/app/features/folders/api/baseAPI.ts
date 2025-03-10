import { createApi } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';
import { createBaseQuery } from 'app/api/createBaseQuery';

export const BASE_URL = `apis/folder.grafana.app/v0alpha1/namespaces/${config.namespace}`;

export const baseAPI = createApi({
  reducerPath: 'folderAPI',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
