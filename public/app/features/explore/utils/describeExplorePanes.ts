import { type ExploreUrlState, urlUtil } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { isRecord } from 'app/core/utils/isRecord';

import { parseURL } from '../hooks/useStateSync/parseURL';

/**
 * Datasource-specific query text fields, most common first (Prometheus/Loki, Elastic/Tempo, SQL, Graphite,
 * CloudWatch). Datasources define their own text via `getQueryDisplayText`, but that needs the plugin module
 * loaded; reading the field keeps callers like the homepage from loading plugins for a subtitle. Queries
 * that keep their text elsewhere (nested shapes such as Azure's) get no text, not a wrong one.
 */
const QUERY_TEXT_FIELDS = ['expr', 'query', 'rawSql', 'target', 'expression'] as const;

export interface ExplorePaneDescription {
  /** Datasource name, or the raw ref from the URL when it no longer resolves; `undefined` when the pane has none. */
  datasource: string | undefined;
  /** Text of each query that has any. */
  queries: string[];
}

function getQueryText(query: unknown): string {
  if (!isRecord(query)) {
    return '';
  }
  for (const field of QUERY_TEXT_FIELDS) {
    const value = query[field];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

async function describePane(pane: ExploreUrlState): Promise<ExplorePaneDescription> {
  const datasource = pane.datasource
    ? ((await getDataSourceInstanceSettings(pane.datasource))?.name ?? pane.datasource)
    : undefined;
  // The v1 migrator keeps `null` query elements and the v0 parser can keep a non-array `queries`.
  const queries: unknown[] = Array.isArray(pane.queries) ? pane.queries : [];
  return { datasource, queries: queries.map(getQueryText).filter(Boolean) };
}

/**
 * What an Explore URL's `search` would restore, per pane; panes with neither datasource nor query text
 * are omitted. Never throws: stored URLs are runtime input, and an unknown `schemaVersion` makes
 * `parseURL` index past its migrators.
 */
export async function describeExplorePanes(search: string): Promise<ExplorePaneDescription[]> {
  try {
    const [url] = parseURL(urlUtil.parseKeyValue(search.replace(/^\?/, '')));
    const panes = await Promise.all(Object.values(url.panes).map(describePane));
    return panes.filter((pane) => pane.datasource || pane.queries.length > 0);
  } catch {
    return [];
  }
}
