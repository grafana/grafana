import { type HybridSearchResultItem } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { dispatch } from 'app/types/store';

export interface HybridSearchOptions {
  limit?: number;
}

/**
 * Hybrid search over dashboards via the core dashboard API. Returns one hit per
 * dashboard, ordered by descending relevance (best match first) and
 * RBAC-filtered server-side. Gate calls on the grafana.cmdkHybridSearch flag.
 */
export async function searchDashboardsHybrid(
  query: string,
  { limit }: HybridSearchOptions = {}
): Promise<HybridSearchResultItem[]> {
  const request = dispatch(
    dashboardAPIv0alpha1.endpoints.listDashboardHybridSearchV0Alpha1.initiate(
      {
        hybridSearchQuery: {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'HybridSearchQuery',
          query,
          ...(limit !== undefined && { limit }),
        },
      },
      // Refresh repeat searches so recently saved dashboards can appear immediately.
      { subscribe: false, forceRefetch: true }
    )
  );

  const response = await request.unwrap();
  return response.items ?? [];
}
