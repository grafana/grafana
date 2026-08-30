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
  // The diagnostics endpoints re-run these raw queries server-side without the frontend
  // `applyTemplateVariables` step that `/api/ds/query` applies, so without interpolating here the
  // bundle would capture literal `$var` queries instead of what actually ran.
  return Promise.all(
    // Interpolate per query (not per panel) so a mixed-datasource panel resolves each query against
    // its own datasource. Queries are never dropped or reordered, so the captured set matches what ran.
    queries.map(async (query) => {
      // Expression queries execute server-side against other refIds -- there is nothing to interpolate.
      if (isExpressionReference(query.datasource)) {
        return query;
      }
      try {
        // scopedVars carries `__sceneObject`, which lets a datasource ref that is itself a variable
        // (e.g. `$ds`) resolve to this panel's concrete instance.
        const ds = await getDataSourceInstance(query.datasource, scopedVars);
        // The same scopedVars lets the core `TemplateSrv` delegate to the scene interpolator,
        // resolving scene variables including a repeated panel's clone-local value.
        return ds.interpolateVariablesInQueries?.([query], scopedVars, adhocFilters)?.[0] ?? query;
      } catch {
        // Fall back to the raw query if the datasource can't be resolved or interpolated.
        return query;
      }
    })
  );
}
