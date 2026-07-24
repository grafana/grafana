import { type AdHocVariableFilter, type ScopedVars } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';

/**
 * Interpolates template and scoped variables in a panel's queries before they hit the diagnostics
 * endpoints.
 */
export async function interpolateDiagnosticsQueries(
  queries: DataQuery[],
  scopedVars: ScopedVars,
  adhocFilters?: AdHocVariableFilter[]
): Promise<DataQuery[]> {
  return Promise.all(
    queries.map(async (query) => {
      if (isExpressionReference(query.datasource)) {
        return query;
      }
      try {
        const ds = await getDataSourceInstance(query.datasource, scopedVars);
        return ds.interpolateVariablesInQueries?.([query], scopedVars, adhocFilters)?.[0] ?? query;
      } catch {
        return query;
      }
    })
  );
}
