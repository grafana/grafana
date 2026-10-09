import { type ExploreUrlState, urlUtil } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { isRecord } from 'app/core/utils/isRecord';

import { parseURL } from '../hooks/useStateSync/parseURL';

/**
 * Datasource-specific query text fields, most common first (Prometheus/Loki, Elastic/Tempo, SQL, Graphite,
 * CloudWatch). This is a hint for a subtitle, not `createQueryText`: that needs the datasource plugin loaded
 * for `getQueryDisplayText`, and its no-plugin fallback is the whole query model as JSON, which must stay
 * faithful for copying but is noise here. Queries that keep their text elsewhere (nested shapes such as
 * Azure's) get no text, not a wrong one.
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

/**
 * `<datasource name>: <text>`; the raw ref when the datasource no longer resolves; text alone when the query
 * has no ref; `''` when it has no text.
 */
async function describeMixedQuery(query: unknown): Promise<string> {
  const text = getQueryText(query);
  if (!text) {
    return '';
  }
  const ref = isRecord(query) ? query.datasource : undefined;
  const refString = typeof ref === 'string' ? ref : isRecord(ref) && typeof ref.uid === 'string' ? ref.uid : undefined;
  if (!refString) {
    return text;
  }
  const name = (await getDataSourceInstanceSettings(typeof ref === 'string' ? ref : { uid: refString }))?.name;
  return `${name ?? refString}: ${text}`;
}

async function describePane(pane: ExploreUrlState): Promise<ExplorePaneDescription> {
  const settings = pane.datasource ? await getDataSourceInstanceSettings(pane.datasource) : undefined;
  // The v1 migrator keeps `null` query elements and the v0 parser can keep a non-array `queries`.
  const queries: unknown[] = Array.isArray(pane.queries) ? pane.queries : [];
  if (settings?.meta.mixed) {
    // The pane's "-- Mixed --" says nothing; each query names its own datasource.
    const texts = await Promise.all(queries.map(describeMixedQuery));
    return { datasource: undefined, queries: texts.filter(Boolean) };
  }
  return {
    datasource: settings?.name ?? (pane.datasource || undefined),
    queries: queries.map(getQueryText).filter(Boolean),
  };
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
