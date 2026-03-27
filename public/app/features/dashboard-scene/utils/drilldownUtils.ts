import { DrilldownsApplicability } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable, sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { getDatasourceFromQueryRunner } from './getDatasourceFromQueryRunner';

// Inline check until isGroupByFilter is available from @grafana/scenes
function isGroupByFilter(filter: { operator: string }): boolean {
  return filter.operator === 'groupBy';
}

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
  if (!filtersVar && !groupByVar) {
    return;
  }

  const datasource = getDatasourceFromQueryRunner(queryRunner);
  const queries = queryRunner.state.data?.request?.targets ?? queryRunner.state.queries;

  const ds = await getDataSourceSrv().get(datasource?.uid);

  if (!ds.getDrilldownsApplicability) {
    return;
  }

  const dsUid = sceneGraph.interpolate(queryRunner, datasource?.uid);
  const hasFiltersApplicability =
    filtersVar && dsUid === sceneGraph.interpolate(filtersVar, filtersVar.state?.datasource?.uid);

  const useAdhocGroupBy = filtersVar?.state.enableGroupBy === true;
  const hasGroupByApplicability =
    !useAdhocGroupBy && groupByVar && dsUid === sceneGraph.interpolate(groupByVar, groupByVar.state.datasource?.uid);

  if (!hasFiltersApplicability && !hasGroupByApplicability) {
    return;
  }

  const filters: Array<{ key: string; operator: string; value: string; origin?: string; values?: string[] }> = [];
  const groupByKeys: string[] = [];

  if (hasFiltersApplicability) {
    const allFilters = [...filtersVar.state.filters, ...(filtersVar.state.originFilters ?? [])];
    filters.push(...allFilters.filter((f) => !isGroupByFilter(f)));

    if (useAdhocGroupBy) {
      groupByKeys.push(...allFilters.filter((f) => isGroupByFilter(f)).map((f) => f.key));
    }
  }

  if (hasGroupByApplicability) {
    const value = groupByVar.state.value;
    const keys = Array.isArray(value) ? value.map((v) => String(v)) : value ? [String(value)] : [];
    groupByKeys.push(...keys);
  }

  const timeRange = sceneGraph.getTimeRange(queryRunner).state.value;

  return await ds.getDrilldownsApplicability({
    filters,
    ...(groupByKeys.length > 0 ? { groupByKeys } : {}),
    queries,
    timeRange,
    scopes: sceneGraph.getScopes(queryRunner),
  });
}
