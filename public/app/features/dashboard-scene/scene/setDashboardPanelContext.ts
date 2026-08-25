import { AnnotationChangeEvent, type AnnotationEventUIModel, CoreApp, type DataFrame } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { getDatasourcePluginMeta } from '@grafana/runtime/internal';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import {
  AdHocFiltersVariable,
  dataLayers,
  isSystemTransformation,
  sceneGraph,
  type SceneDataTransformation,
  sceneUtils,
  type VizPanel,
} from '@grafana/scenes';
import { type DataSourceRef, type DataTransformerConfig } from '@grafana/schema';
import { type AdHocFilterItem, type PanelContext } from '@grafana/ui';
import { FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { annotationServer } from 'app/features/annotations/api';
import { InspectTab } from 'app/features/inspector/types';

import { openPanelInspector } from '../inspect/panelInspectorOpener';
import { filterDataTransformerConfigs } from '../panel-edit/PanelEditNext/QueryEditor/utils';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';
import {
  getDashboardSceneFor,
  getDataTransformerFor,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  isNewPanelQueryErrorsUIEnabled,
} from '../utils/utils';

import { type DashboardScene } from './DashboardScene';
import { adHocTransformationsEnabled } from './systemTransformations';

export function setDashboardPanelContext(vizPanel: VizPanel, context: PanelContext) {
  const dashboard = getDashboardSceneFor(vizPanel);

  // Read on access. The panel context is built once and cached on the VizPanel, but deactivating the
  // dashboard clears its event bus, so a subscription here would be dropped and never re-established.
  Object.defineProperty(context, 'app', {
    enumerable: true,
    configurable: true,
    get: () => (dashboard.state.editPanel ? CoreApp.PanelEditor : CoreApp.Dashboard),
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

    if (dashboard) {
      return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canEdit);
    }

    return false;
  };

  context.canDeleteAnnotations = (dashboardUID?: string) => {
    const dashboard = getDashboardSceneFor(vizPanel);

    if (dashboard) {
      return Boolean(dashboard.state.meta.annotationsPermissions?.dashboard.canDelete);
    }

    return false;
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

    await annotationServer().save(anno, getCurrentScopeNames(vizPanel));

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

    await annotationServer().update(anno, getCurrentScopeNames(vizPanel));

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
      const datasourceToLoad = await getDataSourceInstance(datasource);
      datasource = {
        uid: datasourceToLoad.uid,
        type: datasourceToLoad.type,
      };
    }

    const filterVar = await getAdHocFilterVariableFor(dashboard, datasource);
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

    let currentValues: string[] = [];

    if (groupByVar) {
      const val = groupByVar.state.value;
      currentValues = Array.isArray(val) ? val.map(String) : val ? [String(val)] : [];
    } else {
      const adhocVar = getAdHocGroupByVariableFor(dashboard, datasource);
      if (adhocVar) {
        currentValues = adhocVar.state.filters.filter((f) => f.operator === 'groupBy').map((f) => f.key);
      }
    }

    if (currentValues.length === 0) {
      return [];
    }

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
      const datasourceToLoad = await getDataSourceInstance(datasource);
      datasource = {
        uid: datasourceToLoad.uid,
        type: datasourceToLoad.type,
      };
    }
    const filterVar = await getAdHocFilterVariableFor(dashboard, datasource);
    bulkUpdateAdHocFiltersVariable(filterVar, items);

    if (items.length > 0) {
      const isFilterOut = items.every((item) => item.operator === FILTER_OUT_OPERATOR);
      reportInteraction(
        isFilterOut ? 'grafana_unified_drilldown_tooltip_filter_out' : 'grafana_unified_drilldown_tooltip_filter_for',
        { filtersCount: items.length }
      );
    }
  };

  // Gated at build time rather than per call: both members are absent when this dashboard cannot
  // take the write, which is how a panel knows not to render the affordance at all.
  if (adHocTransformationsEnabled() && dashboard.canEditDashboard()) {
    // Read on access, like `app` above: the context is built once and cached on the VizPanel while
    // the transformation list changes underneath it.
    Object.defineProperty(context, 'transformations', {
      enumerable: true,
      configurable: true,
      get: () => {
        const transformer = getDataTransformerFor(vizPanel);
        return transformer ? asConfigs(transformer.state.transformations) : undefined;
      },
    });

    context.onTransformationsChange = (transformations) => {
      // setUserTransformations rather than setState: it reprocesses the pipeline itself, and it drops
      // origin-tagged entries from the array it is handed instead of letting a caller persist one.
      getDataTransformerFor(vizPanel)?.setUserTransformations(transformations);
    };
  }

  context.canExecuteActions = () => {
    const dashboard = getDashboardSceneFor(vizPanel);
    return dashboard.canEditDashboard();
  };

  context.onUpdateData = (frames: DataFrame[]): Promise<boolean> => {
    // TODO
    //return onUpdatePanelSnapshotData(this.props.panel, frames);
    return Promise.resolve(true);
  };

  // Only wire up the status-popover inspector opener when the new panel errors UI is enabled.
  // Its presence is also the signal the panel renderer uses to show the new errors/notices popover.
  // Opening goes through a registered opener to avoid importing PanelInspectDrawer here (circular dep).
  if (isNewPanelQueryErrorsUIEnabled()) {
    context.onOpenInspector = () => openPanelInspector(vizPanel, InspectTab.ErrorsAndNotices);
  }
}

/** Keyed on the state array, which scenes replaces on every write. */
const configsByTransformations = new WeakMap<SceneDataTransformation[], DataTransformerConfig[]>();

/**
 * The panel's transformations in the shape `PanelContext.transformations` promises: configs only,
 * since a panel can do nothing with a custom operator, and nothing carrying an origin, which belongs
 * to the provider that registered it and is never persisted.
 *
 * Memoized because the getter is read on every render: a panel using the value as an effect dep, or
 * comparing it to decide whether to re-derive, needs repeat reads between writes to be the same array.
 */
function asConfigs(transformations: SceneDataTransformation[]): DataTransformerConfig[] {
  const cached = configsByTransformations.get(transformations);

  if (cached) {
    return cached;
  }

  const configs = filterDataTransformerConfigs(transformations.filter((t) => !isSystemTransformation(t)));

  configsByTransformations.set(transformations, configs);

  return configs;
}

/**
 * Reads the current scope names from the scene graph so they can be persisted alongside
 * a manually created/updated annotation, mirroring how `SceneQueryRunner` propagates
 * `request.scopes` to panel queries.
 */
function getCurrentScopeNames(sceneObject: VizPanel): string[] {
  return sceneGraph.getScopes(sceneObject)?.map((scope) => scope.metadata.name) ?? [];
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

function getAdHocGroupByVariableFor(scene: DashboardScene, ds: DataSourceRef | null | undefined) {
  const variables = sceneGraph.getVariables(scene);

  for (const variable of variables.state.variables) {
    if (sceneUtils.isAdHocVariable(variable) && variable.state.enableGroupBy) {
      const filtersDs = variable.state.datasource;
      if (filtersDs === ds || filtersDs?.uid === ds?.uid) {
        return variable;
      }
    }
  }

  return null;
}

export async function getAdHocFilterVariableFor(scene: DashboardScene, ds: DataSourceRef | null | undefined) {
  // Resolve plugin meta before scanning so no await sits between the read and the
  // setState write. Overlapping "Filter for value" actions would otherwise both
  // miss the existing-variable scan and append a second Filters variable.
  const pluginId = ds?.type ?? (await getDataSourceInstanceSettings(ds))?.type ?? '';
  const supportsMultiValueOperators = Boolean((await getDatasourcePluginMeta(pluginId))?.multiValueFilterOperators);

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
    supportsMultiValueOperators,
    useQueriesAsFilterForOptions: true,
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
    const existingFilterIndex = updatedFilters.findIndex(
      (filter) => filter.key === newFilter.key && filter.value === newFilter.value
    );

    if (existingFilterIndex >= 0) {
      // An identical filter is already applied, adding it again would duplicate it in the filter bar.
      // Update is only required when the operator changed (key1 = value1 -> key1 != value1).
      if (updatedFilters[existingFilterIndex].operator !== newFilter.operator) {
        updatedFilters.splice(existingFilterIndex, 1, newFilter);
        hasChanges = true;
      }
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
