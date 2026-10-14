import { BASE_URL as v0alphaBaseURL } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getBackendSrv } from '@grafana/runtime';

const DASHBOARD_HYBRID_SEARCH_URL = `${v0alphaBaseURL}/dashboards/search/hybrid`;

// These types mirror pkg/apis/search/v0alpha1/hybrid.go because generic
// hybrid routes are excluded from generated API clients.
export interface HybridSearchResult {
  resource: {
    group: string;
    resource: string;
    kind: string;
    name: string;
  };
  score: number;
  title: string;
  folder: string;
  folderTitle?: string;
  managedBy?: { kind: string; id: string };
  chunks: Array<{ subresource: string; content: string }>;
}

interface HybridSearchResponse {
  apiVersion: 'search.grafana.app/v0alpha1';
  kind: 'HybridSearchResults';
  items: HybridSearchResult[];
}

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
): Promise<HybridSearchResult[]> {
  const response = await getBackendSrv().post<HybridSearchResponse>(
    DASHBOARD_HYBRID_SEARCH_URL,
    {
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'HybridSearchQuery',
      query,
      ...(limit !== undefined && { limit }),
    },
    // Background searches fall back to classic search on failure, so they
    // should not show error toasts on palette keystrokes.
    { showErrorAlert: false, abortSignal }
  );
  return response.items ?? [];
}
