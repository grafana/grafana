import { type AdHocVariableFilter, type DataSourceApi, type ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceInstance } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

export interface InterpolateSourceQueriesOptions {
  /** Scoped vars used to resolve a data source variable, such as `${ds}`, in a query's data source ref. */
  dataSourceScopedVars?: ScopedVars;
  /** Rejects when a data source cannot be loaded, instead of returning its queries unchanged. */
  throwOnMissingDataSource?: boolean;
}

// The base `applyTemplateVariables` returns the query unchanged, and the base
// `interpolateVariablesInQueries` calls `applyTemplateVariables`. So when a data source keeps the base
// `applyTemplateVariables`, `interpolateVariablesInQueries` is the only hook that can do anything, and
// some data sources (such as Azure Monitor) override only that one.
function overridesApplyTemplateVariables(ds: DataSourceApi): ds is DataSourceWithBackend {
  return (
    ds instanceof DataSourceWithBackend &&
    ds.applyTemplateVariables !== DataSourceWithBackend.prototype.applyTemplateVariables
  );
}

function prepareDataSourceQueries(
  ds: DataSourceApi,
  queries: DataQuery[],
  scopedVars: ScopedVars,
  filters?: AdHocVariableFilter[]
): DataQuery[] {
  // Each data source gets its own copy: some hooks, such as InfluxDB's `applyTemplateVariables`,
  // change the scopedVars they get, which would leak into the next data source and the caller.
  scopedVars = { ...scopedVars };
  if (ds instanceof DataSourceWithBackend && typeof ds.prepareBackendQueries === 'function') {
    return ds.prepareBackendQueries(queries, scopedVars, filters);
  }
  // A panel's request runs `applyTemplateVariables` on each query before it reaches the backend.
  if (overridesApplyTemplateVariables(ds)) {
    return queries.map((query) => ds.applyTemplateVariables(query, scopedVars, filters));
  }
  if (typeof ds.interpolateVariablesInQueries === 'function') {
    return ds.interpolateVariablesInQueries(queries, scopedVars, filters);
  }
  return queries;
}

/**
 * Prepares each data source query with the same per-data-source hooks a panel request uses
 * (`applyTemplateVariables`, or `prepareBackendQueries` when defined), so the expression
 * query path, the SQL Expressions schema inspector and field autocomplete prepare queries
 * the same way.
 *
 * - Resolves each query's datasource via `getDataSourceInstance()`.
 * - Uses the data source's `prepareBackendQueries` when it has one. Otherwise uses
 *   `applyTemplateVariables` when the data source overrides it, and
 *   `interpolateVariablesInQueries` when it does not.
 * - Passes each data source all of its queries in one call, as a panel does, so it can
 *   resolve references between them (such as Graphite's `#A`). Results are matched back
 *   by refId because a data source may return them in a different order.
 * - Keeps each query's `datasource` and `hide`, which the hooks may drop.
 * - Falls back to the original query when the datasource has none of these hooks, or when
 *   it is unavailable and `throwOnMissingDataSource` is not set.
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
    const byRefId = new Map(
      prepareDataSourceQueries(
        ds,
        indexes.map((i) => queries[i]),
        scopedVars,
        filters
      ).map((q) => [q.refId, q])
    );
    for (const i of indexes) {
      const query = queries[i];
      const prepared = byRefId.get(query.refId);
      // The hooks may build a new query object. Keep the data source, so the request routes it, and
      // `hide`, so the backend still leaves hidden inputs out of the response.
      result[i] = prepared
        ? {
            ...prepared,
            datasource: prepared.datasource ?? query.datasource,
            ...(query.hide !== undefined && { hide: query.hide }),
          }
        : query;
    }
  }

  return result;
}
