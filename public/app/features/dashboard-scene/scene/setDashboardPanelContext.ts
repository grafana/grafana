import { distinctUntilChanged, takeUntil, takeWhile, timer } from 'rxjs';

import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { AnnotationChangeEvent, type AnnotationEventUIModel, CoreApp, type DataFrame } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { getDatasourcePluginMeta } from '@grafana/runtime/internal';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import {
  AdHocFiltersVariable,
  dataLayers,
  sceneGraph,
  sceneUtils,
  type SceneObject,
  type SceneVariables,
  type VizPanel,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { type AdHocFilterItem, type PanelContext } from '@grafana/ui';
import { FILTER_OUT_OPERATOR } from '@grafana/ui/internal';
import { getAssistantChatIdToContinue } from 'app/core/assistant/assistantSidebarState';
import { annotationServer } from 'app/features/annotations/api';
import { InspectTab } from 'app/features/inspector/types';

import { buildEntries } from '../inspect/StandardErrorsAndNoticesInspector';
import { openPanelInspector } from '../inspect/panelInspectorOpener';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../utils/getDatasourceFromQueryRunner';
import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';
import { getDashboardSceneFor, isNewPanelQueryErrorsUIEnabled } from '../utils/utils';
import { getPanelIdForVizPanel } from '../utils/utils-panels';

import { type DashboardScene } from './DashboardScene';
import { refuseWhilePlanning } from './refuseWhilePlanning';

// How long to wait for the assistant app plugin to report availability before giving up. Preloaded
// app plugins finish importing before the rest of Grafana boots, so this window is normally
// sub-second; this only needs to cover a slower-than-usual load, not the typical case. See the
// comment at the isAssistantAvailable() subscription below for why this exists.
const ASSISTANT_AVAILABILITY_TIMEOUT_MS = 5000;

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

    // An immediate backend write, reachable by the ordinary drag-to-annotate gesture regardless
    // of edit mode — canAddAnnotations() below has no isEditing check either, so this is the real
    // chokepoint.
    if (refuseWhilePlanning(dashboard)) {
      return;
    }

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

    if (refuseWhilePlanning(dashboard)) {
      return;
    }

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
    if (refuseWhilePlanning(getDashboardSceneFor(vizPanel))) {
      return;
    }

    await annotationServer().delete({ id });

    reRunBuiltInAnnotationsLayer(getDashboardSceneFor(vizPanel));

    context.eventBus.publish(new AnnotationChangeEvent({ id }));
  };

  context.onAddAdHocFilter = async (newFilter: AdHocFilterItem) => {
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

    const filterVar = await getAdHocFilterVariableFor(vizPanel, datasource);
    updateAdHocFilterVariable(filterVar, newFilter);
  };

  context.getFiltersBasedOnGrouping = (items: AdHocFilterItem[]) => {
    const queryRunner = getQueryRunnerFor(vizPanel);
    if (!queryRunner) {
      return [];
    }

    const datasource = getDatasourceFromQueryRunner(queryRunner);
    const groupByVar = getGroupByVariableFor(vizPanel, datasource);

    let currentValues: string[] = [];

    if (groupByVar) {
      const val = groupByVar.state.value;
      currentValues = Array.isArray(val) ? val.map(String) : val ? [String(val)] : [];
    } else {
      const adhocVar = getAdHocGroupByVariableFor(vizPanel, datasource);
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
    const filterVar = await getAdHocFilterVariableFor(vizPanel, datasource);
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
  // The opener loads the inspector on demand to avoid importing the drawer here (and creating a circular dependency).
  //
  // A third route to inspect-panel, independent of the 'i' keyboard shortcut (guarded in
  // keyboardShortcuts.ts) and the menu item (unreachable -- preview panels have no menu at all).
  // Unreachable while the sample generator never reports an error for this popover to attach to;
  // would need this guard the moment that changes, so it stays guarded directly.
  if (isNewPanelQueryErrorsUIEnabled()) {
    context.onOpenInspector = () => {
      if (refuseWhilePlanning(getDashboardSceneFor(vizPanel))) {
        return;
      }
      openPanelInspector(vizPanel, InspectTab.ErrorsAndNotices);
    };

    // We subscribe because the assistant plugin may still be loading. The timeout prevents a memory leak
    // if the assistant is never installed, since there's no cleanup hook when the panel is removed.
    isAssistantAvailable()
      .pipe(
        distinctUntilChanged(),
        takeWhile((available) => !available, true),
        takeUntil(timer(ASSISTANT_AVAILABILITY_TIMEOUT_MS))
      )
      .subscribe((available) => {
        context.onInvestigateErrors = available ? () => investigatePanelErrorsWithAssistant(vizPanel) : undefined;
        vizPanel.forceRender();
      });
  }
}

/**
 * Checks the panel's current errors/notices (mirroring the "Errors and notices" inspector tab)
 * to decide whether there's anything to investigate, then opens the assistant with a reference
 * to the panel itself rather than a text snapshot of its errors.
 *
 * Attaching the panel this way (name/panelId/panelKey) mirrors the assistant's own "select a
 * panel as context" picker (PanelSelectButton in grafana-assistant-app), so the assistant
 * resolves it through the same path and can inspect the panel's live queries/data with its own
 * tools instead of trusting a frozen description we send in the prompt.
 */
function investigatePanelErrorsWithAssistant(vizPanel: VizPanel) {
  if (refuseWhilePlanning(getDashboardSceneFor(vizPanel))) {
    return;
  }

  const panelData = sceneGraph.getData(vizPanel).state.data;
  const errors = panelData?.errors ?? (panelData?.error ? [panelData.error] : []);
  const entries = buildEntries(panelData?.series, errors);

  if (entries.length === 0) {
    return;
  }

  // Everything below is model-facing (it's serialized into the `<ref />` the assistant sends the
  // LLM), so the fallback stays in English like the prompt does.
  const panelTitle = vizPanel.interpolate(vizPanel.state.title, undefined, 'text') || 'Untitled';
  const panelKey = vizPanel.state.key;
  const hasError = entries.some((entry) => entry.severity === 'error');
  // Prompt text sent to the assistant is intentionally not translated (matching
  // QueryErrorAlert.tsx/AnalyzeRuleButton.tsx): it's an instruction to the LLM, not rendered
  // UI copy, so it stays in English regardless of UI locale.
  const prompt = hasError
    ? 'Investigate and fix the query errors causing this panel to fail.'
    : 'Investigate the query notices for this panel and explain what they mean and what I should do about them.';

  openAssistant({
    origin: 'grafana/panel-status-popover',
    mode: 'assistant',
    prompt,
    autoSend: true,
    appendContext: true,
    // When the assistant is already on screen, target its active chat instead of just
    // republishing the same "open" props — otherwise it being open already swallows this.
    chatId: getAssistantChatIdToContinue(),
    context: [
      createAssistantContextItem('structured', {
        data: {
          name: `Panel: ${panelTitle}`,
          // A string, matching PanelSelectButton in grafana-assistant-app — nothing reads this
          // field back, it's only serialized into the `<ref />` for the model.
          panelId: String(getPanelIdForVizPanel(vizPanel)),
          panelKey,
        },
      }),
    ],
  });
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

// Ordered closest-to-farthest so callers can prefer a row-local variable over the dashboard-global one.
function getVariableSetsInHierarchy(sceneObject: SceneObject): SceneVariables[] {
  const sets: SceneVariables[] = [];
  let current: SceneObject | undefined = sceneObject;

  while (current) {
    if (current.state.$variables) {
      sets.push(current.state.$variables);
    }
    current = current.parent;
  }

  return sets;
}

function getGroupByVariableFor(sceneObject: SceneObject, ds: DataSourceRef | null | undefined) {
  for (const variables of getVariableSetsInHierarchy(sceneObject)) {
    for (const variable of variables.state.variables) {
      if (sceneUtils.isGroupByVariable(variable)) {
        const filtersDs = variable.state.datasource;
        if (filtersDs === ds || filtersDs?.uid === ds?.uid) {
          return variable;
        }
      }
    }
  }

  return null;
}

function getAdHocGroupByVariableFor(sceneObject: SceneObject, ds: DataSourceRef | null | undefined) {
  for (const variables of getVariableSetsInHierarchy(sceneObject)) {
    for (const variable of variables.state.variables) {
      if (sceneUtils.isAdHocVariable(variable) && variable.state.enableGroupBy) {
        const filtersDs = variable.state.datasource;
        if (filtersDs === ds || filtersDs?.uid === ds?.uid) {
          return variable;
        }
      }
    }
  }

  return null;
}

export async function getAdHocFilterVariableFor(sceneObject: SceneObject, ds: DataSourceRef | null | undefined) {
  // Resolve plugin meta before scanning so no await sits between the read and the
  // setState write. Overlapping "Filter for value" actions would otherwise both
  // miss the existing-variable scan and append a second Filters variable.
  const pluginId = ds?.type ?? (await getDataSourceInstanceSettings(ds))?.type ?? '';
  const supportsMultiValueOperators = Boolean((await getDatasourcePluginMeta(pluginId))?.multiValueFilterOperators);

  for (const variables of getVariableSetsInHierarchy(sceneObject)) {
    for (const variable of variables.state.variables) {
      if (sceneUtils.isAdHocVariable(variable)) {
        const filtersDs = variable.state.datasource;
        if (filtersDs === ds || filtersDs?.uid === ds?.uid) {
          return variable;
        }
      }
    }
  }

  // No matching filter variable exists anywhere in the hierarchy - create one at the dashboard
  // level, same as if the dashboard had no section-local filters at all.
  const dashboard = getDashboardSceneFor(sceneObject);
  const variables = sceneGraph.getVariables(dashboard);

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
