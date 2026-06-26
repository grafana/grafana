import { BASE_URL as v0alphaBaseURL } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { getBackendSrv } from '@grafana/runtime';
import { type SearchAPIResponse, type SearchHit } from 'app/features/search/service/unified';

// Core unified-storage semantic search, exposed as a sibling of the lexical
// `/search` route. Gated behind the dashboardVectorSearch feature toggle and
// only functional when the vector backend is configured (501 otherwise).
export const DASHBOARD_VECTOR_SEARCH_URL = `${v0alphaBaseURL}/search/vector`;

/**
 * A single panel-level semantic match. One dashboard can yield multiple results
 * (one per matching panel). Mirrors the lexical search hit, flattened to the
 * fields the deep search column needs.
 */
export interface DeepSearchPanelResult {
  dashboardUid: string;
  dashboardTitle: string;
  /** The embedded text that matched (panel titles, descriptions, queries). */
  content: string;
  /** Cosine distance — lower means a closer match. */
  score: number;
  panelId?: number;
  /** Folder UID; the human title is resolved separately via the folder lookup. */
  folderUid?: string;
  /** Resolved folder title — set by the folder lookup, or directly by the mock. */
  folderTitle?: string;
  rowName?: string;
  datasourceUid?: string;
  language?: string;
}

export interface DeepSearchOptions {
  limit?: number;
  abortSignal?: AbortSignal;
}

/** Parses the panel id out of a hit's `panel/<id>` subresource string. */
function parsePanelId(subresource: string | number | undefined): number | undefined {
  if (typeof subresource !== 'string') {
    return undefined;
  }
  const match = /^panel\/(\d+)$/.exec(subresource);
  return match ? Number(match[1]) : undefined;
}

function hitToPanelResult(hit: SearchHit): DeepSearchPanelResult {
  const field = hit.field ?? {};
  return {
    dashboardUid: hit.name,
    dashboardTitle: hit.title,
    content: typeof field.snippet === 'string' ? field.snippet : '',
    score: typeof field.score === 'number' ? field.score : 0,
    panelId: parsePanelId(field.subresource),
    folderUid: hit.folder || undefined,
  };
}

/**
 * Semantic search over dashboard content via the core dashboard API. Results are
 * ordered by ascending distance (best match first) and RBAC-filtered server-side.
 * Gate calls on the dashboardVectorSearch feature toggle.
 */
export async function searchDashboardVector(
  query: string,
  { limit, abortSignal }: DeepSearchOptions = {}
): Promise<DeepSearchPanelResult[]> {
  const response = await getBackendSrv().get<SearchAPIResponse>(
    DASHBOARD_VECTOR_SEARCH_URL,
    { query, ...(limit !== undefined && { limit }) },
    undefined,
    // This runs in the background on palette keystrokes; an unconfigured backend
    // returns 501 and a feature-flagged-off instance returns 404 — neither
    // should spam error toasts
    { showErrorAlert: false, abortSignal }
  );
  return (response.hits ?? []).map(hitToPanelResult);
}
