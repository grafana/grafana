import { getBackendSrv } from '@grafana/runtime';

export interface UserSuggestion {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
}

interface UserSearchResponse {
  users: Array<{
    id: number;
    login: string;
    name?: string;
    avatarUrl?: string;
  }>;
}

/**
 * searchUsers hits the existing legacy users-search endpoint. We
 * intentionally use the legacy /api/users/search rather than building a
 * dedicated mention search so that orgs that have customized user
 * visibility get the same result here as elsewhere in Grafana.
 *
 * The optional AbortSignal lets callers cancel a stale debounced
 * request: getBackendSrv doesn't accept AbortSignal directly, so we
 * race the network response against the signal and discard the result
 * if the signal aborted before the fetch resolved.
 */
export async function searchUsers(query: string, signal?: AbortSignal): Promise<UserSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const url = new URL('/api/users/search', window.location.origin);
  url.searchParams.set('perpage', '10');
  url.searchParams.set('page', '1');
  url.searchParams.set('query', trimmed);

  const data = await getBackendSrv().get<UserSearchResponse>(url.pathname + url.search, undefined, undefined, {
    showErrorAlert: false,
  });
  if (signal?.aborted) {
    return [];
  }
  if (!data) {
    return [];
  }
  return data.users.map((u) => ({
    id: u.id,
    login: u.login,
    name: u.name,
    avatarUrl: u.avatarUrl,
  }));
}

export interface PanelSuggestion {
  id: number;
  title: string;
}

/**
 * panelSuggestionsFromState walks the dashboard scene state and produces
 * the searchable panel list. Pulled out as a pure function for testability;
 * the composer wires it to scene state via a callback prop.
 */
export function filterPanels(panels: PanelSuggestion[], query: string): PanelSuggestion[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return panels.slice(0, 10);
  }
  return panels
    .filter((p) => p.title.toLowerCase().includes(trimmed) || String(p.id).includes(trimmed))
    .slice(0, 10);
}
