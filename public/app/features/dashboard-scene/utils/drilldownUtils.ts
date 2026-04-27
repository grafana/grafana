import type { AdHocVariableFilter, DrilldownsApplicability } from '@grafana/data/types';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  type AdHocFiltersVariable,
  type GroupByVariable,
  isGroupByFilter,
  sceneGraph,
  type SceneObject,
  type SceneQueryRunner,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

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

  const filters: AdHocVariableFilter[] = [];
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
