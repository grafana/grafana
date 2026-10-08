import { isRecord } from 'app/core/utils/isRecord';

import { type PageIdentity } from './types';

/**
 * Maps a base-url-less URL to the page it belongs to, or `null` for pages that are not worth resuming
 * (home, browse pages, settings, Explore before it has written its state, ...). First matching rule wins.
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
