import { type AdHocVariableFilter, type ScopedVars } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';

/**
 * Interpolates template and scoped variables in a panel's queries before they are submitted to the
 * diagnostics endpoints.
 *
 * The diagnostics endpoints re-run raw queries server-side and, unlike the normal `/api/ds/query`
 * path, nothing applies the frontend `applyTemplateVariables` step first. Without this, a templated
 * panel's bundle would capture literal `$var` queries — a different request than the one that
 * actually misbehaved, which undermines every downstream comparison in the bundle.
 *
 * Each query is interpolated by its own datasource's `interpolateVariablesInQueries` (per-query, so
 * mixed-datasource panels resolve correctly). `scopedVars` must carry `__sceneObject` (e.g.
 * `{ __sceneObject: { value: vizPanel } }`) so the core `TemplateSrv` delegates to the scene
 * interpolator and resolves scene variables, including a repeated panel's clone-local value.
 *
 * Queries are never dropped or reordered, so the captured set matches what ran: expression
 * (`__expr__`) queries pass through unchanged (they execute server-side and reference other refIds),
 * and any query whose datasource cannot be resolved or interpolated falls back to its raw form.
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
        const ds = await getDataSourceInstance(query.datasource);
        return ds.interpolateVariablesInQueries?.([query], scopedVars, adhocFilters)?.[0] ?? query;
      } catch {
        return query;
      }
    })
  );
}
