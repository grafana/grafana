import { isEqual } from 'lodash';

import { AnnotationChangeEvent, type AnnotationEventUIModel, CoreApp, type DataFrame } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { AdHocFiltersVariable, dataLayers, sceneGraph, sceneUtils, type VizPanel } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { type AdHocFilterItem, type PanelContext, type PanelInlineEditChannel } from '@grafana/ui';
import { FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { annotationServer } from 'app/features/annotations/api';
import { InspectTab } from 'app/features/inspector/types';

import { openPanelInspector } from '../inspect/panelInspectorOpener';
// Not `sidebar/shared`, whose `dashboardEditActions.edit` would cycle back here through the
// editable element classes. `events` is dependency-free by design.
import { DashboardEditActionEvent } from '../sidebar/events';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';
import {
  getDashboardSceneFor,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  isLibraryPanel,
  isNewPanelQueryErrorsUIEnabled,
} from '../utils/utils';

import { type DashboardScene } from './DashboardScene';

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

  context.inlineEdit = createPanelInlineEditChannel(dashboard, vizPanel);

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
      const datasourceToLoad = await getDataSourceSrv().get(datasource);
      datasource = {
        uid: datasourceToLoad.uid,
        type: datasourceToLoad.type,
      };
    }
    const filterVar = getAdHocFilterVariableFor(dashboard, datasource);
    bulkUpdateAdHocFiltersVariable(filterVar, items);

    if (items.length > 0) {
      const isFilterOut = items.every((item) => item.operator === FILTER_OUT_OPERATOR);
      reportInteraction(
        isFilterOut ? 'grafana_unified_drilldown_tooltip_filter_out' : 'grafana_unified_drilldown_tooltip_filter_for',
        { filtersCount: items.length }
      );
    }
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

  // Only wire up the status-popover inspector opener when the new panel errors UI is enabled.
  // Its presence is also the signal the panel renderer uses to show the new errors/notices popover.
  // Opening goes through a registered opener to avoid importing PanelInspectDrawer here (circular dep).
  if (isNewPanelQueryErrorsUIEnabled()) {
    context.onOpenInspector = () => openPanelInspector(vizPanel, InspectTab.ErrorsAndNotices);
  }
}

/**
 * Lets a panel plugin offer in-place editing without reaching into dashboard code. Takes the
 * concrete `vizPanel` rather than a panel id, which is what tells a repeat clone from its source —
 * they share the id in `PanelProps`.
 */
function createPanelInlineEditChannel(dashboard: DashboardScene, vizPanel: VizPanel): PanelInlineEditChannel {
  const getState = () => {
    const { isEditing, editPanel, viewPanel, sidebar } = dashboard.state;
    const { selected } = sidebar.state.selectionContext;

    return (
      Boolean(isEditing) &&
      dashboard.canEditDashboard() &&
      // The panel editor owns editing while it is open, and a maximized panel is for viewing.
      !editPanel &&
      !viewPanel &&
      // Multi-select drives bulk actions, where opening an editor in every panel would fight the user.
      selected.length === 1 &&
      selected[0].id === vizPanel.state.key &&
      // Repeat clones are rebuilt from their source, and library panel options are saved to the
      // library rather than the dashboard, so edits to either would be silently dropped.
      !isRepeatCloneOrChildOf(vizPanel) &&
      !isLibraryPanel(vizPanel)
    );
  };

  const subscribe = (onStoreChange: () => void) => {
    let sidebar = dashboard.state.sidebar;
    let sidebarSub = sidebar.subscribeToState(onStoreChange);

    const dashboardSub = dashboard.subscribeToState((state) => {
      // Discarding changes and exiting edit mode restore a cloned sidebar, so the reference moves.
      if (state.sidebar !== sidebar) {
        sidebarSub.unsubscribe();
        sidebar = state.sidebar;
        sidebarSub = sidebar.subscribeToState(onStoreChange);
      }

      onStoreChange();
    });

    return () => {
      dashboardSub.unsubscribe();
      sidebarSub.unsubscribe();
    };
  };

  const beginOptionsEditSession = () => {
    const previousOptions = vizPanel.state.options;

    return () => {
      const nextOptions = vizPanel.state.options;
      if (isEqual(previousOptions, nextOptions)) {
        return;
      }

      // As well as recording the undo entry, this makes the sidebar emit DashboardStateChangedEvent,
      // which is what tells a repeating grid item to rebuild its clones from the edited panel.
      vizPanel.publishEvent(
        new DashboardEditActionEvent({
          description: t('dashboard.edit-actions.change-panel-options', 'Change panel options'),
          source: vizPanel,
          // The options are already applied, so this is a no-op the first time and a redo later.
          perform: () => vizPanel.onOptionsChange(nextOptions, true),
          undo: () => vizPanel.onOptionsChange(previousOptions, true),
        }),
        true
      );
    };
  };

  return { getState, subscribe, beginOptionsEditSession };
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
