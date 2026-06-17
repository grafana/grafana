import { type AdHocVariableFilter, type ScopedVars } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

/**
 * Runs each data source query through its own `interpolateVariablesInQueries`
 * implementation when available, so downstream callers (e.g. the SQL Expressions
 * schema inspector and field autocomplete) send the same interpolated queries the
 * panel execution path would.
 *
 * - Resolves each query's datasource via `getDataSourceSrv().get()`.
 * - Delegates interpolation to the datasource; falls back to the original query
 *   when the datasource is unavailable or does not implement `interpolateVariablesInQueries`.
 * - Intentionally generic: no per-datasource logic.
 */
export async function interpolateSourceQueries(
  queries: DataQuery[],
  scopedVars: ScopedVars,
  filters?: AdHocVariableFilter[]
): Promise<DataQuery[]> {
  return Promise.all(
    queries.map(async (query) => {
      let ds;
      try {
        ds = await getDataSourceSrv().get(query.datasource);
      } catch {
        return query;
      }

      if (typeof ds.interpolateVariablesInQueries !== 'function') {
        return query;
      }

      const [interpolated] = ds.interpolateVariablesInQueries([query], scopedVars, filters);
      return interpolated ?? query;
    })
  );
}
