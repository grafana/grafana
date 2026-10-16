import { locationUtil, type NavModelItem } from '@grafana/data';
import { findByUrl } from 'app/core/components/AppChrome/MegaMenu/utils';
import { isRecord } from 'app/core/utils/isRecord';

import { type PageIdentity } from './types';

/**
 * Maps a base-url-less URL to the page it belongs to, or `null` for pages that are not worth resuming
 * (home, browse pages, settings, Explore before it has written its state, a nav menu destination opened as
 * the menu opens it, ...). First matching rule wins.
 */
export function classifyPage(pathname: string, search: string, navTree: NavModelItem[]): PageIdentity | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const [, first, second] = normalized.split('/');

  if (first === 'd' && second) {
    return { kind: 'dashboard', uid: second, pathname: normalized };
  }

  if (normalized === '/explore') {
    const session = exploreSession(search);
    return session ? { kind: 'explore', session, pathname: normalized } : null;
  }

  if (first === 'a' && second) {
    return hasNothingToResume(normalized, search, navTree) ? null : { kind: 'app', pathname: normalized };
  }

  if (first === 'alerting') {
    return hasNothingToResume(normalized, search, navTree) ? null : { kind: 'alerting', pathname: normalized };
  }

  return null;
}

/** Carried on many URLs without saying anything about the page's state. */
const PLUMBING_PARAMS = ['orgId', 'returnTo'];

/** Create forms: `…/new`, and `/alerting/new/:type`. What is typed into one lives in the form, not the URL. */
function isCreateForm(pathname: string): boolean {
  return pathname.endsWith('/new') || pathname.startsWith('/alerting/new/');
}

/**
 * A nav menu destination opened the way the menu opens it is one click away; a create form reopens blank. Neither
 * is worth a row unless its URL carries state of its own (a filter, a tab, prefilled values). Pages the menu does
 * not link to (a rule, an incident) are always kept. Starred dashboards are nav items too, so this is not for `/d/`.
 */
function hasNothingToResume(pathname: string, search: string, navTree: NavModelItem[]): boolean {
  const hasState = [...new URLSearchParams(search)].some(([key, value]) => value && !PLUMBING_PARAMS.includes(key));
  return !hasState && (isCreateForm(pathname) || findByUrl(navTree, locationUtil.assureBaseUrl(pathname)) !== null);
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
    case 'alerting':
    case 'app':
      return page.pathname;
  }
}
