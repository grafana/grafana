import { type AdHocVariableFilter, type DataSourceApi, type ScopedVars } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

export interface InterpolateSourceQueriesOptions {
  /** Scoped vars used to resolve a data source variable, such as `${ds}`, in a query's data source ref. */
  dataSourceScopedVars?: ScopedVars;
  /** Rejects when a data source cannot be loaded, instead of returning its queries unchanged. */
  throwOnMissingDataSource?: boolean;
}

/**
 * Runs each data source query through its own `interpolateVariablesInQueries`
 * implementation when available, so callers (the expression query path, the SQL
 * Expressions schema inspector and field autocomplete) send the same interpolated
 * queries the panel execution path would.
 *
 * - Resolves each query's datasource via `getDataSourceInstance()`.
 * - Passes each data source all of its queries in one call, as a panel does, so it can
 *   resolve references between them (such as Graphite's `#A`). Results are matched back
 *   by refId because a data source may return them in a different order.
 * - Falls back to the original query when the datasource does not implement
 *   `interpolateVariablesInQueries`, or when it is unavailable and
 *   `throwOnMissingDataSource` is not set.
 * - Intentionally generic: no per-datasource logic.
 */
export async function interpolateSourceQueries(
  queries: DataQuery[],
  scopedVars: ScopedVars,
  filters?: AdHocVariableFilter[],
  options: InterpolateSourceQueriesOptions = {}
): Promise<DataQuery[]> {
  const { dataSourceScopedVars, throwOnMissingDataSource = false } = options;
  const instances = await Promise.all(
    queries.map(async (query) => {
      try {
        return await getDataSourceInstance(query.datasource, dataSourceScopedVars);
      } catch (error) {
        if (throwOnMissingDataSource) {
          throw error;
        }
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
