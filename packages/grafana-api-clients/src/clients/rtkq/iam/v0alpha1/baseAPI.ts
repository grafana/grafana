import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

export const API_GROUP = 'iam.grafana.app' as const;
export const API_VERSION = 'v0alpha1' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

const namespacedBaseQuery = createBaseQuery({ baseURL: BASE_URL });
const clusterBaseQuery = createBaseQuery({ baseURL: `/apis/${API_GROUP}/${API_VERSION}` });

export const api = createApi({
  reducerPath: 'iamAPIv0alpha1',
  baseQuery: (args, api, extraOptions) =>
    args.url === '/whoami' ? clusterBaseQuery(args, api, extraOptions) : namespacedBaseQuery(args, api, extraOptions),
  endpoints: () => ({}),
});
