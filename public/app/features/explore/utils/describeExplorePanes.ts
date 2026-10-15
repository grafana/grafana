import { type ExploreUrlState, urlUtil } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime';
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

/** What a row needs to know about a datasource, by uid and by name: Explore URLs have carried either. */
export type ExploreDataSources = ReadonlyMap<string, { name: string; mixed: boolean }>;

/**
 * One snapshot of the datasource list, shared by every Explore row. Never throws: names are a nicety, so without
 * the list the rows show the refs from the URL as they are.
 */
export async function getExploreDataSources(): Promise<ExploreDataSources> {
  const dataSources = new Map<string, { name: string; mixed: boolean }>();
  try {
    for (const item of await getDataSourceInstanceList({ all: true, mixed: true })) {
      const dataSource = { name: item.name, mixed: item.meta.mixed === true };
      dataSources.set(item.uid, dataSource);
      dataSources.set(item.name, dataSource);
    }
  } catch (error) {
    console.error('Failed to load datasources for recent Explore pages', error);
  }
  return dataSources;
}

export interface ExplorePaneDescription {
  /** Datasource name, or the ref from the URL when it no longer resolves; `undefined` when the pane has none. */
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

/** The uid (or legacy name) a query's own `datasource` points at, in either shape Explore has written. */
function getQueryRef(query: unknown): string | undefined {
  const ref = isRecord(query) ? query.datasource : undefined;
  if (typeof ref === 'string') {
    return ref;
  }
  return isRecord(ref) && typeof ref.uid === 'string' ? ref.uid : undefined;
}

function describePane(pane: ExploreUrlState, dataSources: ExploreDataSources): ExplorePaneDescription {
  const ref = pane.datasource || undefined;
  const dataSource = ref ? dataSources.get(ref) : undefined;
  // The v1 migrator keeps `null` query elements and the v0 parser can keep a non-array `queries`.
  const queries: unknown[] = Array.isArray(pane.queries) ? pane.queries : [];
  const texts = queries.map((query) => {
    const text = getQueryText(query);
    // In a mixed pane each query names its own datasource; the pane's name alone would not say which.
    const queryRef = dataSource?.mixed && text ? getQueryRef(query) : undefined;
    return queryRef ? `${dataSources.get(queryRef)?.name ?? queryRef}: ${text}` : text;
  });
  return { datasource: dataSource?.name ?? ref, queries: texts.filter(Boolean) };
}

/**
 * What an Explore URL's `search` would restore, per pane; panes with neither datasource nor query text are
 * omitted. Never throws: stored URLs are runtime input, and an unknown `schemaVersion` makes `parseURL` index
 * past its migrators.
 */
export function describeExplorePanes(search: string, dataSources: ExploreDataSources): ExplorePaneDescription[] {
  let panes: ExploreUrlState[];
  try {
    const [url] = parseURL(urlUtil.parseKeyValue(search.replace(/^\?/, '')));
    panes = Object.values(url.panes);
  } catch {
    return [];
  }
  return panes
    .map((pane) => describePane(pane, dataSources))
    .filter((pane) => pane.datasource || pane.queries.length > 0);
}
