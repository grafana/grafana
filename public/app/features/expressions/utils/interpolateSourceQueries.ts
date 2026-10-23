import { type AdHocVariableFilter, type DataSourceApi, type ScopedVars } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

/**
 * Runs each data source query through its own `interpolateVariablesInQueries`
 * implementation when available, so downstream callers (e.g. the SQL Expressions
 * schema inspector and field autocomplete) send the same interpolated queries the
 * panel execution path would.
 *
 * - Resolves each query's datasource via `getDataSourceInstance()`.
 * - Passes each data source all of its queries in one call, as a panel does, so it can
 *   resolve references between them (such as Graphite's `#A`). Results are matched back
 *   by refId because a data source may return them in a different order.
 * - Falls back to the original query when the datasource is unavailable or does not
 *   implement `interpolateVariablesInQueries`.
 * - Intentionally generic: no per-datasource logic.
 */
export async function interpolateSourceQueries(
  queries: DataQuery[],
  scopedVars: ScopedVars,
  filters?: AdHocVariableFilter[]
): Promise<DataQuery[]> {
  const instances = await Promise.all(
    queries.map(async (query) => {
      try {
        return await getDataSourceInstance(query.datasource);
      } catch {
        return undefined;
      }
    })
  );

  const groups = new Map<string | undefined, { ds: DataSourceApi; indexes: number[] }>();
  instances.forEach((ds, i) => {
    if (!ds) {
      return;
    }
    const group = groups.get(ds.uid) ?? { ds, indexes: [] };
    group.indexes.push(i);
    groups.set(ds.uid, group);
  });

  const result = [...queries];
  for (const { ds, indexes } of groups.values()) {
    if (typeof ds.interpolateVariablesInQueries !== 'function') {
      continue;
    }
    const byRefId = new Map(
      ds
        .interpolateVariablesInQueries(
          indexes.map((i) => queries[i]),
          scopedVars,
          filters
        )
        .map((q) => [q.refId, q])
    );
    for (const i of indexes) {
      result[i] = byRefId.get(queries[i].refId) ?? queries[i];
    }
  }

  return result;
}
