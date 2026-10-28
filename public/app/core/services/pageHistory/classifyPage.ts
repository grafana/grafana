import { ASSISTANT_PAGES_PATH } from 'app/core/constants';
import { isRecord } from 'app/core/utils/isRecord';

import { type PageIdentity } from './types';

/**
 * Maps a base-url-less URL to the page it belongs to, or `null` for URLs that are no page to come back to
 * (home, browse pages, settings, Explore before it has written its state, ...). First matching rule wins.
 * Whether a visit to the page is worth a row is `hasNothingToResume`'s question, not this one's.
 */
export function classifyPage(pathname: string, search: string): PageIdentity | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const [, first, second] = normalized.split('/');

  if (first === 'd' && second) {
    return { kind: 'dashboard', uid: second, pathname: normalized };
  }

  if (normalized === '/explore') {
    const session = exploreSession(search);
    return session ? { kind: 'explore', session, pathname: normalized } : null;
  }

  // Individual Pages are their own kind. The list at ASSISTANT_PAGES_PATH is a browse page (an "App" row for it
  // would sit oddly above the "Page" rows for what it lists), and `new/…` is the create flow: the Page gets its
  // row once it exists at its own id.
  if (normalized === ASSISTANT_PAGES_PATH || normalized.startsWith(`${ASSISTANT_PAGES_PATH}/`)) {
    const [pageId] = normalized.slice(ASSISTANT_PAGES_PATH.length + 1).split('/');
    return pageId && pageId !== 'new' ? { kind: 'page', pathname: normalized } : null;
  }

  if (first === 'a' && second) {
    return { kind: 'app', pathname: normalized };
  }

  if (first === 'alerting') {
    return { kind: 'alerting', pathname: normalized };
  }

  return null;
}

/**
 * Id of the left pane in Explore's v1 URL (`panes` is a JSON object keyed by pane id, left pane first).
 * Absent until Explore has written its URL, and for older URL formats, which Explore rewrites to v1 on load.
 */
function exploreSession(search: string): string | undefined {
  const panes = new URLSearchParams(search).get('panes');
  if (!panes) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(panes);
    const [first] = isRecord(parsed) && !Array.isArray(parsed) ? Object.keys(parsed) : [];
    return first || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Params that reopen a panel editor, settings view, inspect drawer, share drawer or kiosk mode; a row must bring
 * the user back to the dashboard, not into one of those. `DashboardSceneUrlSync.getKeys()` lists the scene's
 * URL state; `viewPanel` is left in on purpose, a viewed panel is a state worth returning to, and `kiosk` is
 * the chrome's, not the scene's.
 */
const DASHBOARD_TRANSIENT_PARAMS = ['editPanel', 'editview', 'inspect', 'shareView', 'kiosk', 'drow'];

/** The part of `search` a row stores for `page`: dashboards drop their transient UI params, other kinds keep everything. */
export function recordableSearch(page: PageIdentity, search: string): string {
  if (page.kind !== 'dashboard') {
    return search;
  }
  const params = new URLSearchParams(search);
  for (const key of DASHBOARD_TRANSIENT_PARAMS) {
    params.delete(key);
  }
  const kept = params.toString();
  return kept ? `?${kept}` : '';
}

/** Dedupe key: two URLs with the same key are the same history row. */
export function pageKey(page: PageIdentity): string {
  switch (page.kind) {
    case 'dashboard':
      return `dashboard:${page.uid}`;
    case 'explore':
      return `explore:${page.session}`;
    case 'page':
    case 'alerting':
    case 'app':
      return page.pathname;
  }
}
