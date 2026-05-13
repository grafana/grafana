import { getBackendSrv } from '@grafana/runtime';

export interface UserSuggestion {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
}

interface OrgUsersSearchResponse {
  orgUsers: Array<{
    userId: number;
    login: string;
    name?: string;
    avatarUrl?: string;
  }>;
  totalCount?: number;
  page?: number;
  perPage?: number;
}

interface SearchUsersOptions {
  signal?: AbortSignal;
  /** Drop this user id from the results. We never want to mention ourselves. */
  excludeUserId?: number;
}

/**
 * searchUsers hits /api/org/users/search — the org-scoped user search.
 * The global /api/users/search route is gated behind the global
 * `users:read` permission (Grafana Server Admin only), so Org Admins
 * and below see a 403 there. The org-scoped endpoint is gated behind
 * `org.users:read`, which any role with org membership can be granted,
 * so it is the right surface for @-mention pickers inside an org.
 *
 * The optional AbortSignal lets callers cancel a stale debounced
 * request: getBackendSrv doesn't accept AbortSignal directly, so we
 * race the network response against the signal and discard the result
 * if the signal aborted before the fetch resolved.
 *
 * `excludeUserId` filters the current user out of the suggestion list
 * so people don't accidentally @-mention themselves; we ask for one
 * extra row from the API to keep the visible page size at 10 even
 * when the current user matches the query.
 */
export async function searchUsers(query: string, options: SearchUsersOptions = {}): Promise<UserSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const { signal, excludeUserId } = options;
  const url = new URL('/api/org/users/search', window.location.origin);
  url.searchParams.set('perpage', excludeUserId ? '11' : '10');
  url.searchParams.set('page', '1');
  url.searchParams.set('query', trimmed);

  const data = await getBackendSrv().get<OrgUsersSearchResponse>(url.pathname + url.search, undefined, undefined, {
    showErrorAlert: false,
  });
  if (signal?.aborted) {
    return [];
  }
  if (!data || !Array.isArray(data.orgUsers)) {
    return [];
  }
  const users = data.orgUsers
    .filter((u) => excludeUserId === undefined || u.userId !== excludeUserId)
    .slice(0, 10)
    .map((u) => ({
      id: u.userId,
      login: u.login,
      name: u.name,
      avatarUrl: u.avatarUrl,
    }));
  return users;
}

export interface PanelSuggestion {
  id: number;
  title: string;
}

/**
 * filterPanels narrows the panel list by a query string, matched
 * case-insensitively against the panel title or its numeric id. Pulled
 * out as a pure function for testability; the composer wires it to
 * scene state via a callback prop.
 */
export function filterPanels(panels: PanelSuggestion[], query: string): PanelSuggestion[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return panels.slice(0, 10);
  }
  return panels.filter((p) => p.title.toLowerCase().includes(trimmed) || String(p.id).includes(trimmed)).slice(0, 10);
}

/**
 * ResourceSuggestion is the generic shape used by the composer's `#`
 * picker when it offers cross-resource mentions (dashboard, folder).
 * The id is the resource's UID — string-typed because dashboard and
 * folder UIDs are not numeric like panel ids are.
 */
export interface ResourceSuggestion {
  uid: string;
  title: string;
}

/**
 * filterResourceSuggestions narrows a resource list (dashboards in a
 * folder, etc.) by a query string. Same case-insensitive prefix-or-
 * substring match against title or UID that filterPanels uses for
 * panels, so the picker behaves identically across mention kinds.
 */
export function filterResourceSuggestions(items: ResourceSuggestion[], query: string): ResourceSuggestion[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return items.slice(0, 10);
  }
  return items
    .filter((r) => r.title.toLowerCase().includes(trimmed) || r.uid.toLowerCase().includes(trimmed))
    .slice(0, 10);
}
