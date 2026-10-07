import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { type PageIdentity } from './types';

/** Apps whose `/a/<pluginId>/investigation(s)/<id>` routes are tracked as one row per investigation id. */
const INVESTIGATION_PLUGIN_IDS: string[] = [ASSISTANT_PLUGIN_ID, 'grafana-ml-app'];

const INVESTIGATION_SEGMENTS = ['investigations', 'investigation'];

/**
 * Maps a base-url-less pathname to the page it belongs to, or `null` for pages that are not worth
 * resuming (home, browse pages, settings, ...). First matching rule wins.
 */
export function classifyPage(pathname: string): PageIdentity | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const [, first, second, third, fourth] = normalized.split('/');

  if (first === 'd' && second) {
    return { kind: 'dashboard', uid: second };
  }

  if (normalized === '/explore') {
    return { kind: 'explore' };
  }

  if (first === 'a' && second) {
    if (INVESTIGATION_PLUGIN_IDS.includes(second) && third && INVESTIGATION_SEGMENTS.includes(third) && fourth) {
      return { kind: 'investigation', pluginId: second, id: fourth };
    }
    return { kind: 'app', pathname: normalized };
  }

  if (first === 'alerting') {
    return { kind: 'alerting', pathname: normalized };
  }

  return null;
}

/** Dedupe key: two URLs with the same key are the same history row. */
export function pageKey(page: PageIdentity): string {
  switch (page.kind) {
    case 'dashboard':
      return `dashboard:${page.uid}`;
    case 'explore':
      return 'explore';
    case 'investigation':
      return `investigation:${page.id}`;
    case 'alerting':
    case 'app':
      return page.pathname;
  }
}
