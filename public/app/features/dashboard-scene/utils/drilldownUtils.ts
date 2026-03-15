import { DrilldownsApplicability } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable, sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';
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
  filtersVar?: AdHocFiltersVariable,
  groupByVar?: GroupByVariable
): Promise<DrilldownsApplicability[] | undefined> {
  //if no drilldown vars return
  if (!filtersVar && !groupByVar) {
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
  const timeRange = sceneGraph.getTimeRange(queryRunner).state.value;
  const groupByKeys = [];
  const filters = [];

  const hasGroupByApplicability =
    groupByVar && dsUid === sceneGraph.interpolate(groupByVar, groupByVar?.state.datasource?.uid);
  const hasFiltersApplicability =
    filtersVar && dsUid === sceneGraph.interpolate(filtersVar, filtersVar.state?.datasource?.uid);

  // if neither vars use the ds from the queries, return
  if (!hasGroupByApplicability && !hasFiltersApplicability) {
    return;
  }

  if (hasGroupByApplicability) {
    groupByKeys.push(
      ...(Array.isArray(groupByVar.state.value)
        ? groupByVar.state.value.map((v) => String(v))
        : groupByVar.state.value
          ? [String(groupByVar.state.value)]
          : [])
    );
  }

  if (hasFiltersApplicability) {
    filters.push(...filtersVar.state.filters, ...(filtersVar.state.originFilters ?? []));
  }

  return await ds.getDrilldownsApplicability({
    groupByKeys,
    filters,
    queries,
    timeRange,
    scopes: sceneGraph.getScopes(queryRunner),
  });
}
