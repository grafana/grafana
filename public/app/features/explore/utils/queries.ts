import { getNextRefId } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { isRecord } from 'app/core/utils/isRecord';

/**
 * Datasource-specific query text fields, most common first (Prometheus/Loki, Elastic/Tempo, SQL, InfluxQL,
 * Graphite, CloudWatch). A hint for summaries, not `createQueryText`: that needs the datasource plugin loaded for
 * `getQueryDisplayText`, and its no-plugin fallback is the whole query model as JSON, which must stay faithful for
 * copying but is noise in a summary. Queries that keep their text elsewhere (nested shapes such as Azure's) get
 * no text, not a wrong one.
 */
const QUERY_TEXT_FIELDS = ['expr', 'query', 'rawSql', 'rawQuery', 'target', 'expression'] as const;

/** The text of a query as the user wrote it, without loading its datasource plugin; `undefined` when none is found. */
export function getQueryExpressionText(query: unknown): string | undefined {
  if (!isRecord(query)) {
    return undefined;
  }
  for (const field of QUERY_TEXT_FIELDS) {
    const value = query[field];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

/**
 * Makes sure all the queries have unique (and valid) refIds
 */
export function withUniqueRefIds(queries: DataQuery[]): DataQuery[] {
  const refIds = new Set<string>(queries.map((query) => query.refId).filter(Boolean));

  if (refIds.size === queries.length) {
    return queries;
  }

  refIds.clear();

  return queries.map((query) => {
    if (query.refId && !refIds.has(query.refId)) {
      refIds.add(query.refId);
      return query;
    }

    const refId = getNextRefId(queries);
    refIds.add(refId);

    const newQuery = {
      ...query,
      refId,
    };

    return newQuery;
  });
}
