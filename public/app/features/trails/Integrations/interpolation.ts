import { AdHocVariableFilter, DataSourceInstanceSettings } from '@grafana/data';
import { PromQuery, PrometheusDatasource } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, SceneVariable } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

export function interpolateVariables(
  dashboard: DashboardModel | DashboardScene,
  dsInstanceSettings: DataSourceInstanceSettings,
  queries: DataQuery[]
) {
  const promDataSourceForUtility = new PrometheusDatasource({ ...dsInstanceSettings, jsonData: {} });

  return queries.filter(isPromQuery).map((query) => {
    const queryDataSourceUid = getInterpolatedDataSourceUid(query?.datasource);
    return promDataSourceForUtility.applyTemplateVariables(query, {}, getAdHocFilters(dashboard, queryDataSourceUid));
  });
}

function getAdHocFilters(dashboard: DashboardModel | DashboardScene, queryDataSourceUid: string | undefined) {
  const adhocFilters: AdHocVariableFilter[] = [];
  if (dashboard instanceof DashboardModel) {
    dashboard.getVariables().forEach((variable) => {
      if (variable.type === 'adhoc') {
        const variableDataSourceUid = getInterpolatedDataSourceUid(variable.datasource);
        if (variableDataSourceUid === queryDataSourceUid) {
          variable.filters.forEach((filter) => adhocFilters.push(filter));
        }
      }
    });
  } else {
    dashboard.state.$variables?.state.variables.filter(isAdHocFiltersVariable).forEach((variable) => {
      const variableDataSourceUid = getInterpolatedDataSourceUid(variable.state.datasource);
      if (variableDataSourceUid === queryDataSourceUid) {
        variable.state.filters.forEach((filter) => adhocFilters.push(filter));
      }
    });
  }

  return adhocFilters;
}

function isPromQuery(model: DataQuery): model is PromQuery {
  return 'expr' in model;
}

function isAdHocFiltersVariable(variable: SceneVariable): variable is AdHocFiltersVariable {
  return variable instanceof AdHocFiltersVariable;
}

function getInterpolatedDataSourceUid(ref: DataSourceRef | null | undefined) {
  const dataSourceInstanceSettings = getDataSourceSrv().getInstanceSettings(ref);
  return dataSourceInstanceSettings?.rawRef?.uid || ref?.uid;
}
