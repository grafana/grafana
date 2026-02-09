import { SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

/**
 * Gets the datasource from a query runner.
 * When no panel-level datasource is set, it means all queries use the same datasource,
 * so we extract the datasource from the first query.
 */
export function getDatasourceFromQueryRunner(queryRunner: SceneQueryRunner): DataSourceRef | null | undefined {
  // Panel-level datasource is set for mixed datasource panels
  if (queryRunner.state.datasource) {
    return queryRunner.state.datasource;
  }

  // No panel-level datasource means all queries share the same datasource
  const firstQuery = queryRunner.state.queries?.[0];
  if (firstQuery?.datasource) {
    return firstQuery.datasource;
  }

  return undefined;
}
