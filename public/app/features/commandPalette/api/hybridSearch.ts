import { BASE_URL as v0alphaBaseURL } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getBackendSrv } from '@grafana/runtime';
import { type SearchAPIResponse, type SearchHit } from 'app/features/search/service/unified';

// Core unified-storage hybrid (lexical + semantic, RRF-fused) search, exposed
// as a sibling of the lexical `/search` route. Gated behind the
// dashboard.vectorSearch feature toggle and only functional when the vector
// backend is configured (501 otherwise).
const DASHBOARD_HYBRID_SEARCH_URL = `${v0alphaBaseURL}/search/hybrid`;

export interface HybridSearchOptions {
  limit?: number;
  abortSignal?: AbortSignal;
}

/**
 * Hybrid search over dashboards via the core dashboard API. Returns one hit per
 * dashboard, ordered by descending relevance (best match first) and
 * RBAC-filtered server-side. Gate calls on the grafana.cmdkHybridSearch flag.
 */
export async function searchDashboardsHybrid(
  query: string,
  { limit, abortSignal }: HybridSearchOptions = {}
): Promise<SearchHit[]> {
  // Using the BackendSrv instead of RTK here, because the API isn't officially published yet and even the open spec
  // gen is behind feature flag.
  const response = await getBackendSrv().get<SearchAPIResponse>(
    DASHBOARD_HYBRID_SEARCH_URL,
    { query, ...(limit !== undefined && { limit }) },
    undefined,
    // This runs in the background on palette keystrokes; an unconfigured backend
    // returns 501 and a feature-flagged-off instance returns 404 — neither
    // should spam error toasts
    { showErrorAlert: false, abortSignal }
  );
  return response.hits ?? [];
}
