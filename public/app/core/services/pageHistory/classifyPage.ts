import { DASHBOARD_KEY_PREFIX, INVESTIGATION_KEY_PREFIX, type PageHistoryKind } from './types';

/** Apps whose `/a/<pluginId>/investigation(s)/<id>` routes are tracked as one row per investigation id. */
const INVESTIGATION_PLUGIN_IDS = ['grafana-assistant-app', 'grafana-ml-app'] as const;

const INVESTIGATION_SEGMENTS = ['investigations', 'investigation'];

export interface ClassifiedPage {
  kind: PageHistoryKind;
  key: string;
}

/**
 * Maps a base-url-less pathname to the history row it belongs to, or `null` for pages that are
 * not worth resuming (home, browse pages, settings, ...). First matching rule wins.
 */
export function classifyPage(pathname: string): ClassifiedPage | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const [, first, second, third, fourth] = normalized.split('/');

  if (first === 'd' && second) {
    return { kind: 'dashboard', key: DASHBOARD_KEY_PREFIX + second };
  }

  if (normalized === '/explore') {
    return { kind: 'explore', key: 'explore' };
  }

  if (first === 'a' && second) {
    const isInvestigationApp = INVESTIGATION_PLUGIN_IDS.some((id) => id === second);
    if (isInvestigationApp && third && INVESTIGATION_SEGMENTS.includes(third) && fourth) {
      return { kind: 'investigation', key: INVESTIGATION_KEY_PREFIX + fourth };
    }
    return { kind: 'app', key: normalized };
  }

  if (first === 'alerting') {
    return { kind: 'alerting', key: normalized };
  }

  return null;
}
