import { getBackendSrv } from '@grafana/runtime';

import { type HookType } from '../types';

export interface UserSuggestion {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
}

interface PulseUserSearchResponse {
  users: Array<{
    userId: number;
    login: string;
    name?: string;
    avatarUrl?: string;
  }>;
}

interface SearchUsersOptions {
  signal?: AbortSignal;
  /** Drop this user id from the results. We never want to mention ourselves. */
  excludeUserId?: number;
}

/**
 * searchUsers hits /api/pulse/users/search — the Pulse-scoped org
 * user search. We don't go through /api/org/users/search because
 * that route requires `org.users:read`, which only Org Admin (and
 * Grafana Server Admin) hold by default — every Viewer / Editor
 * gets a silent 403 there and the @-mention picker shows zero
 * matches. The Pulse-scoped endpoint is gated behind `pulse:read`
 * so any caller who can read Pulse can look up other org members
 * for a mention, while still scoping the search to the caller's
 * own org.
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
  const { signal, excludeUserId } = options;
  const url = new URL('/api/pulse/users/search', window.location.origin);
  url.searchParams.set('perpage', excludeUserId ? '11' : '10');
  url.searchParams.set('page', '1');
  // An empty query lists the first page of org members so a bare `@`
  // surfaces people to mention (matching how the hook picker behaves).
  if (trimmed.length > 0) {
    url.searchParams.set('query', trimmed);
  }

  const data = await getBackendSrv().get<PulseUserSearchResponse>(url.pathname + url.search, undefined, undefined, {
    showErrorAlert: false,
  });
  if (signal?.aborted) {
    return [];
  }
  if (!data || !Array.isArray(data.users)) {
    return [];
  }
  const users = data.users
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

export interface HookSuggestion {
  uid: string;
  name: string;
  type: HookType;
}

interface PulseHookSearchResponse {
  hooks: Array<{
    uid: string;
    name: string;
    type: HookType;
  }>;
}

interface SearchHooksOptions {
  signal?: AbortSignal;
  /** Cap the dropdown so a long hook list can't crowd out user
   *  suggestions in the shared @-picker. Backend also clamps this. */
  limit?: number;
}

/**
 * searchHooks hits /api/pulse/hooks/mentionable — the picker-scoped
 * hook lookup gated behind `pulse:write` (anyone who can author a
 * pulse can mention a hook). It deliberately returns only uid/name/
 * type: no URL, no secret. Disabled hooks are filtered server-side
 * since a mention that won't fire is misleading.
 *
 * Mirrors searchUsers' AbortSignal race so a stale debounced request
 * is discarded rather than clobbering a newer one.
 */
export async function searchHooks(query: string, options: SearchHooksOptions = {}): Promise<HookSuggestion[]> {
  const { signal, limit = 5 } = options;
  const url = new URL('/api/pulse/hooks/mentionable', window.location.origin);
  url.searchParams.set('limit', String(limit));
  const trimmed = query.trim();
  if (trimmed.length > 0) {
    url.searchParams.set('query', trimmed);
  }

  const data = await getBackendSrv().get<PulseHookSearchResponse>(url.pathname + url.search, undefined, undefined, {
    showErrorAlert: false,
  });
  if (signal?.aborted) {
    return [];
  }
  if (!data || !Array.isArray(data.hooks)) {
    return [];
  }
  return data.hooks.slice(0, limit).map((h) => ({ uid: h.uid, name: h.name, type: h.type }));
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
 * picker when it offers cross-resource mentions (dashboard today,
 * future kinds will reuse the shape). The id is the resource's UID
 * — string-typed because dashboard UIDs are not numeric like panel
 * ids are.
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
