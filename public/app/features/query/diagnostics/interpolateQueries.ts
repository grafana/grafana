import { type AdHocVariableFilter, type ScopedVars } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';

/**
 * Interpolates template and scoped variables in a panel's queries before they hit the diagnostics
 * endpoints. Those endpoints re-run raw queries server-side without the frontend
 * `applyTemplateVariables` step that `/api/ds/query` applies, so without this a templated panel's
 * bundle would capture literal `$var` queries instead of what actually ran.
 *
 * Each query is interpolated by its own datasource, so mixed-datasource panels resolve correctly.
 * `scopedVars` must carry `__sceneObject` (e.g. `{ __sceneObject: { value: vizPanel } }`): it lets
 * the core `TemplateSrv` delegate to the scene interpolator (resolving scene variables, including a
 * repeated panel's clone-local value) and lets a datasource ref that is itself a variable (e.g.
 * `$ds`) resolve to this panel's concrete instance.
 *
 * Queries are never dropped or reordered: expression (`__expr__`) queries pass through unchanged, and
 * any query whose datasource can't be resolved or interpolated falls back to its raw form.
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
