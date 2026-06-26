import { createApi } from '@reduxjs/toolkit/query/react';

import { getAPIBaseURL, getAPINamespace } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';

export const API_GROUP = 'dashboard.grafana.app' as const;
export const API_VERSION = 'v0alpha1' as const;

// Retained for callers that build URLs at module load (e.g. the search service);
// these paths are authenticated-only so the namespace is always a real org and the
// org-0 → default rewrite handled by `resolveBaseURL` doesn't apply.
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

// Resolved per-request so anonymous callers (whose namespace is `org-0`) fall back
// to the `default` namespace — required for the public dashboard snapshot view.
function resolveBaseURL() {
  const namespace = getAPINamespace();
  const effective = namespace === 'org-0' ? 'default' : namespace;
  return `/apis/${API_GROUP}/${API_VERSION}/namespaces/${effective}`;
}

export const api = createApi({
  reducerPath: 'dashboardAPIv0alpha1',
  baseQuery: createBaseQuery({
    getBaseURL: () => Promise.resolve(resolveBaseURL()),
  }),
  endpoints: () => ({}),
});
