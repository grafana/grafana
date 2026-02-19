import { AnnotationChangeEvent, AnnotationEventUIModel, CoreApp, DataFrame } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, dataLayers, sceneGraph, sceneUtils, VizPanel } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { AdHocFilterItem, PanelContext } from '@grafana/ui';
import { annotationServer } from 'app/features/annotations/api';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export function setDashboardPanelContext(vizPanel: VizPanel, context: PanelContext) {
  const dashboard = getDashboardSceneFor(vizPanel);
  context.app = dashboard.state.editPanel ? CoreApp.PanelEditor : CoreApp.Dashboard;

  dashboard.subscribeToState((state) => {
    if (state.editPanel) {
      context.app = CoreApp.PanelEditor;
    } else {
      context.app = CoreApp.Dashboard;
    }
  });

  context.canAddAnnotations = () => {
    const dashboard = getDashboardSceneFor(vizPanel);
    const builtInLayer = getBuiltInAnnotationsLayer(dashboard);

    // When there is no builtin annotations query we disable the ability to add annotations
    if (!builtInLayer) {
      return false;
    }

    // If RBAC is enabled there are additional conditions to check.
    return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canAdd);
  };

  context.canEditAnnotations = (dashboardUID?: string) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    if (dashboardUID) {
      return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canEdit);
    }

    return Boolean(dashboard.state.meta.annotationsPermissions?.organization.canEdit);
  };

  context.canDeleteAnnotations = (dashboardUID?: string) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    if (dashboardUID) {
      return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canDelete);
    }

    return Boolean(dashboard.state.meta.annotationsPermissions?.organization.canDelete);
  };

  context.onAnnotationCreate = async (event: AnnotationEventUIModel) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    const isRegion = event.from !== event.to;
    const anno = {
      dashboardUID: dashboard.state.uid,
      panelId: getPanelIdForVizPanel(vizPanel),
      isRegion,
      time: event.from,
      timeEnd: isRegion ? event.to : 0,
      tags: event.tags,
      text: event.description,
    };

    await annotationServer().save(anno);

    reRunBuiltInAnnotationsLayer(dashboard);

    context.eventBus.publish(new AnnotationChangeEvent(anno));
  };

  context.onAnnotationUpdate = async (event: AnnotationEventUIModel) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    const isRegion = event.from !== event.to;
    const anno = {
      id: event.id,
      dashboardUID: dashboard.state.uid,
      panelId: getPanelIdForVizPanel(vizPanel),
      isRegion,
      time: event.from,
      timeEnd: isRegion ? event.to : 0,
      tags: event.tags,
      text: event.description,
    };

    await annotationServer().update(anno);

    reRunBuiltInAnnotationsLayer(dashboard);

    context.eventBus.publish(new AnnotationChangeEvent(anno));
  };

  context.onAnnotationDelete = async (id: string) => {
    await annotationServer().delete({ id });

    reRunBuiltInAnnotationsLayer(getDashboardSceneFor(vizPanel));

    context.eventBus.publish(new AnnotationChangeEvent({ id }));
  };

  context.onAddAdHocFilter = async (newFilter: AdHocFilterItem) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    const queryRunner = getQueryRunnerFor(vizPanel);
    if (!queryRunner) {
      return;
    }

    let datasource = getDatasourceFromQueryRunner(queryRunner);

    // If the datasource is type-only (e.g. it's possible that only group is set in V2 schema queries)
    // we need to resolve it to a full datasource
    if (datasource && !datasource.uid) {
      const datasourceToLoad = await getDataSourceSrv().get(datasource);
      datasource = {
        uid: datasourceToLoad.uid,
        type: datasourceToLoad.type,
      };
    }

    const filterVar = getAdHocFilterVariableFor(dashboard, datasource);
    updateAdHocFilterVariable(filterVar, newFilter);
  };

  context.getFiltersBasedOnGrouping = (items: AdHocFilterItem[]) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    const queryRunner = getQueryRunnerFor(vizPanel);
    if (!queryRunner) {
      return [];
    }

    const datasource = getDatasourceFromQueryRunner(queryRunner);
    const groupByVar = getGroupByVariableFor(dashboard, datasource);

    if (!groupByVar) {
      return [];
    }

    const currentValues = Array.isArray(groupByVar.state.value)
      ? groupByVar.state.value
      : groupByVar.state.value
        ? [groupByVar.state.value]
        : [];

    return items
      .map((item) => (currentValues.find((key) => key === item.key) ? item : undefined))
      .filter((item) => item !== undefined);
  };

  context.onAddAdHocFilters = async (items: AdHocFilterItem[]) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    const queryRunner = getQueryRunnerFor(vizPanel);
    if (!queryRunner) {
      return;
    }

    let datasource = getDatasourceFromQueryRunner(queryRunner);

    // If the datasource is type-only (e.g. it's possible that only group is set in V2 schema queries)
    // we need to resolve it to a full datasource
    if (datasource && !datasource.uid) {
      const datasourceToLoad = await getDataSourceSrv().get(datasource);
      datasource = {
        uid: datasourceToLoad.uid,
        type: datasourceToLoad.type,
      };
    }
    const filterVar = getAdHocFilterVariableFor(dashboard, datasource);
    bulkUpdateAdHocFiltersVariable(filterVar, items);
  };

  context.canExecuteActions = () => {
    const dashboard = getDashboardSceneFor(vizPanel);
    return dashboard.canEditDashboard();
  };

  context.onUpdateData = (frames: DataFrame[]): Promise<boolean> => {
    // TODO
    //return onUpdatePanelSnapshotData(this.props.panel, frames);
    return Promise.resolve(true);
  };
}

function getBuiltInAnnotationsLayer(scene: DashboardScene): dataLayers.AnnotationsDataLayer | undefined {
  const set = dashboardSceneGraph.getDataLayers(scene);
  // When there is no builtin annotations query we disable the ability to add annotations

  for (const layer of set.state.annotationLayers) {
    if (layer instanceof dataLayers.AnnotationsDataLayer) {
      if (layer.state.isEnabled && layer.state.query.builtIn) {
        return layer;
      }
    }
  }

  return undefined;
}

function reRunBuiltInAnnotationsLayer(scene: DashboardScene) {
  const layer = getBuiltInAnnotationsLayer(scene);
  if (layer) {
    layer.runLayer();
  }
}

function getGroupByVariableFor(scene: DashboardScene, ds: DataSourceRef | null | undefined) {
  const variables = sceneGraph.getVariables(scene);

  for (const variable of variables.state.variables) {
    if (sceneUtils.isGroupByVariable(variable)) {
      const filtersDs = variable.state.datasource;
      if (filtersDs === ds || filtersDs?.uid === ds?.uid) {
        return variable;
      }
    }
  }

  return null;
}

export function getAdHocFilterVariableFor(scene: DashboardScene, ds: DataSourceRef | null | undefined) {
  const variables = sceneGraph.getVariables(scene);

  for (const variable of variables.state.variables) {
    if (sceneUtils.isAdHocVariable(variable)) {
      const filtersDs = variable.state.datasource;
      if (filtersDs === ds || filtersDs?.uid === ds?.uid) {
        return variable;
      }
    }
  }

  const newVariable = new AdHocFiltersVariable({
    name: 'Filters',
    datasource: ds,
    supportsMultiValueOperators: Boolean(getDataSourceSrv().getInstanceSettings(ds)?.meta.multiValueFilterOperators),
    useQueriesAsFilterForOptions: true,
    layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
  });

  // Add it to the scene
  variables.setState({
    variables: [...variables.state.variables, newVariable],
  });

  return newVariable;
}

function bulkUpdateAdHocFiltersVariable(filterVar: AdHocFiltersVariable, newFilters: AdHocFilterItem[]) {
  if (!newFilters.length) {
    return;
  }

  const updatedFilters = filterVar.state.filters.slice();
  let hasChanges = false;

  for (const newFilter of newFilters) {
    const filterToReplaceIndex = updatedFilters.findIndex(
      (filter) =>
        filter.key === newFilter.key && filter.value === newFilter.value && filter.operator !== newFilter.operator
    );

    if (filterToReplaceIndex >= 0) {
      updatedFilters.splice(filterToReplaceIndex, 1, newFilter);
      hasChanges = true;
      continue;
    }

    updatedFilters.push(newFilter);
    hasChanges = true;
  }

  if (hasChanges) {
    filterVar.updateFilters(updatedFilters);
  }
}

function updateAdHocFilterVariable(filterVar: AdHocFiltersVariable, newFilter: AdHocFilterItem) {
  // This function handles 'Filter for value' and 'Filter out value' from table cell
  // We are allowing to add filters with the same key because elastic search ds supports that

  // Update is only required when we change operator and keep key and value the same
  //   key1 = value1 -> key1 != value1
  const filterToReplaceIndex = filterVar.state.filters.findIndex(
    (filter) =>
      filter.key === newFilter.key && filter.value === newFilter.value && filter.operator !== newFilter.operator
  );

  if (filterToReplaceIndex >= 0) {
    const updatedFilters = filterVar.state.filters.slice();
    updatedFilters.splice(filterToReplaceIndex, 1, newFilter);
    filterVar.updateFilters(updatedFilters);
    return;
  }

  // Add new filter
  filterVar.updateFilters([...filterVar.state.filters, newFilter]);
}
