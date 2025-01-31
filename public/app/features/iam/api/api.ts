import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '../../../api/createBaseQuery';
import { getAPINamespace } from '../../../api/utils';

export const API_VERSION = 'iam.grafana.app/v0alpha1';

export const BASE_URL = `/apis/${API_VERSION}/namespaces/${getAPINamespace()}`;

export const iamApi = createApi({
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  reducerPath: 'iamAPI',
  endpoints: () => ({}),
});
