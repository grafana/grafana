import {
  type HybridSearchResultItem,
  type ListDashboardHybridSearchV0Alpha1ApiArg,
  type ListDashboardHybridSearchV0Alpha1ApiResponse,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { dispatch } from 'app/types/store';

export interface HybridSearchOptions {
  limit?: number;
}

const cmdkHybridSearchAPI = dashboardAPIv0alpha1.injectEndpoints({
  endpoints: (build) => ({
    listCmdkDashboardHybridSearch: build.query<
      ListDashboardHybridSearchV0Alpha1ApiResponse,
      ListDashboardHybridSearchV0Alpha1ApiArg
    >({
      query: (queryArg) => ({
        url: '/dashboards/search/hybrid',
        method: 'POST',
        body: queryArg.hybridSearchQuery,
        headers: { 'X-Grafana-Caller-Id': 'cmdk' },
      }),
      providesTags: ['Search'],
    }),
  }),
});

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
    cmdkHybridSearchAPI.endpoints.listCmdkDashboardHybridSearch.initiate(
      {
        hybridSearchQuery: {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'HybridSearchQuery',
          query,
          skipRerank: getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaCmdkHybridSearchSkipRerank, false),
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
