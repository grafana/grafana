import { getBackendSrv } from '@grafana/runtime';

import { isDeepSearchMockEnabled, mockSearchDashboardMemory } from './deepSearchMock';

export const DASHBOARD_MEMORY_SEARCH_URL =
  '/api/plugins/grafana-assistant-app/resources/api/v1/memory/dashboards';

/**
 * A single panel-level semantic match from the assistant plugin's dashboard
 * memory store. One dashboard can yield multiple results (one per matching panel).
 */
export interface DashboardMemorySearchResult {
  dashboardUid: string;
  dashboardTitle: string;
  /** The embedded text that matched (panel path, titles, queries). */
  content: string;
  /** Cosine distance — lower means a closer match. */
  score: number;
  panelId?: number;
  folderTitle?: string;
  folderUid?: string;
  rowName?: string;
  datasourceUid?: string;
  language?: string;
  embeddedAt?: number;
}

interface DashboardMemorySearchResponse {
  status: string;
  data: {
    // The endpoint serializes "no hits" as null rather than an empty array
    results: DashboardMemorySearchResult[] | null;
    total: number;
  };
}

export interface DashboardMemorySearchOptions {
  limit?: number;
  abortSignal?: AbortSignal;
}

/**
 * Semantic search over dashboard content via the assistant plugin. Results are
 * ordered by ascending distance (best match first) and RBAC-filtered server-side.
 * Requires the assistant plugin to be available — gate calls on useAssistant().
 */
export async function searchDashboardMemory(
  query: string,
  { limit, abortSignal }: DashboardMemorySearchOptions = {}
): Promise<DashboardMemorySearchResult[]> {
  // TODO: dev-only mock, remove before merging
  if (isDeepSearchMockEnabled()) {
    return mockSearchDashboardMemory(query, limit);
  }

  const response = await getBackendSrv().get<DashboardMemorySearchResponse>(
    DASHBOARD_MEMORY_SEARCH_URL,
    { query, ...(limit !== undefined && { limit }) },
    undefined,
    // This runs in the background on palette keystrokes; a failing/missing
    // plugin must not spam error toasts
    { showErrorAlert: false, abortSignal }
  );
  return response.data.results ?? [];
}
