import { type BaseQueryFn } from '@reduxjs/toolkit/query';
import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPINamespace } from '../../../../utils/utils';
import { createBaseQuery, type RequestOptions } from '../../createBaseQuery';

export const API_GROUP = 'dashboard.grafana.app' as const;
export const API_VERSION = 'v0alpha1' as const;
export const BASE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/${getAPINamespace()}`;

// The public snapshot view is the only flow reachable by anonymous callers, who report
// `org-0` as their namespace. `org-0` is rejected by the apiserver (ParseNamespace requires
// orgID >= 1), so route just those read-by-key endpoints to `default`. The namespace is only
// a routing placeholder here — snapshot GET looks up by global key and ignores it — so any
// valid namespace works. Every other endpoint stays on the caller's real namespace.
const PUBLIC_SNAPSHOT_VIEW_ENDPOINTS = new Set(['getSnapshot', 'getSnapshotDashboard']);
const DEFAULT_NAMESPACE_BASE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default`;
const defaultBaseQuery = createBaseQuery({ baseURL: BASE_URL });
const snapshotBaseQuery = createBaseQuery({ baseURL: DEFAULT_NAMESPACE_BASE_URL });

const baseQuery: BaseQueryFn<RequestOptions> = (args, api, extraOptions) => {
  if (getAPINamespace() === 'org-0' && PUBLIC_SNAPSHOT_VIEW_ENDPOINTS.has(api.endpoint)) {
    return snapshotBaseQuery(args, api, extraOptions);
  }
  return defaultBaseQuery(args, api, extraOptions);
};

export const api = createApi({
  reducerPath: 'dashboardAPIv0alpha1',
  baseQuery,
  endpoints: () => ({}),
});
