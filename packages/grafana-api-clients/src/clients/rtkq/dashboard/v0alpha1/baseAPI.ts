import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPINamespace } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

export const API_GROUP = 'dashboard.grafana.app' as const;
export const API_VERSION = 'v0alpha1' as const;

// Anonymous callers (e.g. the public dashboard snapshot view) get `org-0`, which is
// not a valid k8s namespace; fall back to `default` so those endpoints work.
const namespace = getAPINamespace();
const effectiveNamespace = namespace === 'org-0' ? 'default' : namespace;
export const BASE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/${effectiveNamespace}`;

export const api = createApi({
  reducerPath: 'dashboardAPIv0alpha1',
  baseQuery: createBaseQuery({ baseURL: BASE_URL }),
  endpoints: () => ({}),
});
