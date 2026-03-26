import { DrilldownsApplicability } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, isGroupByFilter, sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { getDatasourceFromQueryRunner } from './getDatasourceFromQueryRunner';

export function verifyDrilldownApplicability(
  sourceObject: SceneObject,
  queriesDataSource: DataSourceRef | null | undefined,
  drilldownDatasource: DataSourceRef | null,
  isApplicabilityEnabled?: boolean
): boolean {
  const datasourceUid = sceneGraph.interpolate(sourceObject, queriesDataSource?.uid);

  return Boolean(
    isApplicabilityEnabled && datasourceUid === sceneGraph.interpolate(sourceObject, drilldownDatasource?.uid)
  );
}

export async function getDrilldownApplicability(
  queryRunner: SceneQueryRunner,
  filtersVar?: AdHocFiltersVariable
): Promise<DrilldownsApplicability[] | undefined> {
  if (!filtersVar) {
    return;
  }

  const datasource = getDatasourceFromQueryRunner(queryRunner);
  // Use executed queries if available, otherwise fall back to configured queries
  const queries = queryRunner.state.data?.request?.targets ?? queryRunner.state.queries;

  const ds = await getDataSourceSrv().get(datasource?.uid);

  // return if method not implemented
  if (!ds.getDrilldownsApplicability) {
    return;
  }

  const dsUid = sceneGraph.interpolate(queryRunner, datasource?.uid);
  const hasFiltersApplicability = dsUid === sceneGraph.interpolate(filtersVar, filtersVar.state?.datasource?.uid);

  if (!hasFiltersApplicability) {
    return;
  }

  const allFilters = [...filtersVar.state.filters, ...(filtersVar.state.originFilters ?? [])];
  const filters = allFilters.filter((f) => !isGroupByFilter(f));
  const groupByKeys = allFilters.filter((f) => isGroupByFilter(f)).map((f) => f.key);

  const timeRange = sceneGraph.getTimeRange(queryRunner).state.value;

  return await ds.getDrilldownsApplicability({
    filters,
    ...(groupByKeys.length > 0 ? { groupByKeys } : {}),
    queries,
    timeRange,
    scopes: sceneGraph.getScopes(queryRunner),
  });
}
