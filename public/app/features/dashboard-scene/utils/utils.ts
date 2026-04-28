import { getDataSourceRef, type IntervalVariableModel, type ScopedVars } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  type CancelActivationHandler,
  type CustomVariable,
  LocalValueVariable,
  type MultiValueVariable,
  SceneDataTransformer,
  sceneGraph,
  type SceneObject,
  type SceneObjectState,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import { type Dashboard, type Panel, type RowPanel } from '@grafana/schema';
import { createLogger } from '@grafana/ui/utils';
import { initialIntervalVariableModelState } from 'app/features/variables/interval/reducer';

import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';
import { type DashboardLayoutOrchestrator } from '../scene/DashboardLayoutOrchestrator';
import { DashboardScene, type DashboardSceneState } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from '../scene/UnconfiguredPanel';
import { VizPanelHeaderActions } from '../scene/VizPanelHeaderActions';
import { VizPanelSubHeader } from '../scene/VizPanelSubHeader';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { type DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { type DashboardDropTarget } from '../scene/types/DashboardDropTarget';
import { type DashboardLayoutManager, isDashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

export const NEW_PANEL_HEIGHT = 8;
export const NEW_PANEL_WIDTH = 12;

const V1_PANEL_PROPERTIES = {
  LIBRARY_PANEL: 'libraryPanel',
  COLLAPSED: 'collapsed',
} as const;

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

export function getPanelIdForVizPanel(panel: SceneObject): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

/**
 * This will also try lookup based on panelId
 */
export function findVizPanelByKey(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = findVizPanelInternal(scene, key);
  if (panel) {
    return panel;
  }

  // Also try to find by panel id
  const id = parseInt(key, 10);
  if (isNaN(id)) {
    return null;
  }

  return findVizPanelInternal(scene, getVizPanelKeyForPanelId(id));
}

function findVizPanelInternal(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = sceneGraph.findObject(scene, (obj) => {
    const objKey = obj.state.key!;

    if (objKey === key) {
      return true;
    }

    if (!(obj instanceof VizPanel)) {
      return false;
    }

    return false;
  });

  if (panel) {
    if (panel instanceof VizPanel) {
      return panel;
    } else {
      throw new Error(`Found panel with key ${key} but it was not a VizPanel`);
    }
  }

  return null;
}

export function findEditPanel(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  let panel: SceneObject | null = findVizPanelByKey(scene, key);
  if (!panel || !panel.state.key) {
    return null;
  }

  if (!(panel instanceof VizPanel)) {
    return null;
  }

  return panel;
}

/**
 * Force re-render children. This is useful in some edge case scenarios when
 * children deep down the scene graph needs to be re-rendered when some parent state change.
 *
 * Example could be isEditing bool flag or a layout IsDraggable state flag.
 *
 * @param model The model whose children should be re-rendered. It does not force render this model, only the children.
 * @param recursive if it should keep force rendering down to leaf nodess
 */
export function forceRenderChildren(model: SceneObject, recursive?: boolean) {
  model.forEachChild((child) => {
    if (!child.isActive) {
      return;
    }

    child.forceRender();
    forceRenderChildren(child, recursive);
  });
}

export function getMultiVariableValues(variable: MultiValueVariable | CustomVariable) {
  const { value, text, options } = variable.state;

  if (variable.hasAllValue()) {
    return {
      values: options.map((o) => o.value),
      texts: options.map((o) => o.label),
    };
  }

  return {
    values: Array.isArray(value) ? value : [value],
    texts: Array.isArray(text) ? text : [text],
  };
}

// used to transform old interval model to new interval model from scenes
export function getIntervalsFromQueryString(query: string | undefined): string[] {
  if (!query) {
    return initialIntervalVariableModelState.query?.split(',') ?? [];
  }

  // separate intervals by quotes either single or double
  const matchIntervals = query.match(/(["'])(.*?)\1|\w+/g);

  // If no intervals are found in query, return the initial state of the interval reducer.
  if (!matchIntervals) {
    return initialIntervalVariableModelState.query?.split(',') ?? [];
  }
  const uniqueIntervals = new Set<string>();

  // when options are defined in variable.query
  const intervals = matchIntervals.reduce((uniqueIntervals: Set<string>, text: string) => {
    // Remove surrounding quotes from the interval value.
    const intervalValue = text.replace(/["']+/g, '');

    // Skip intervals that start with "$__auto_interval_",scenes will handle them.
    if (intervalValue.startsWith('$__auto_interval_')) {
      return uniqueIntervals;
    }

    // Add the interval if it's not already in the Set.
    uniqueIntervals.add(intervalValue);
    return uniqueIntervals;
  }, uniqueIntervals);

  return Array.from(intervals);
}

// Transform new interval scene model to old interval core model
export function getIntervalsQueryFromNewIntervalModel(intervals: string[]): string {
  const variableQuery = Array.isArray(intervals) ? intervals.join(',') : '';
  return variableQuery;
}

export function getCurrentValueForOldIntervalModel(variable: IntervalVariableModel, intervals: string[]): string {
  // Handle missing current object or value
  const currentValue = variable.current?.value;
  const selectedInterval = Array.isArray(currentValue) ? currentValue[0] : currentValue;

  // If no intervals are available, return empty string (will use default from IntervalVariable)
  if (intervals.length === 0) {
    return '';
  }

  // If no selected interval, return the first valid interval
  if (!selectedInterval) {
    return intervals[0];
  }

  // If the interval is the old auto format, return the new auto interval from scenes.
  if (selectedInterval.startsWith('$__auto_interval_') || selectedInterval === '$__auto') {
    return '$__auto';
  }

  // Check if the selected interval is valid.
  if (intervals.includes(selectedInterval)) {
    return selectedInterval;
  }

  // If the selected interval is not valid, return the first valid interval.
  return intervals[0];
}

export function getQueryRunnerFor(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }

  const dataProvider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;

  if (dataProvider instanceof SceneQueryRunner) {
    return dataProvider;
  }

  if (dataProvider instanceof SceneDataTransformer) {
    return getQueryRunnerFor(dataProvider);
  }

  return undefined;
}

export function getDashboardSceneFor(sceneObject: SceneObject): DashboardScene {
  const root = sceneObject.getRoot();

  if (root instanceof DashboardScene) {
    return root;
  }

  throw new Error('SceneObject root is not a DashboardScene');
}

export function getClosestVizPanel(sceneObject: SceneObject): VizPanel | null {
  if (sceneObject instanceof VizPanel) {
    return sceneObject;
  }

  if (sceneObject.parent) {
    return getClosestVizPanel(sceneObject.parent);
  }

  return null;
}

export function getDefaultPluginId(): string {
  return config.featureToggles.dashboardNewLayouts || config.featureToggles.newVizSuggestions
    ? UNCONFIGURED_PANEL_PLUGIN_ID
    : 'timeseries';
}

export function getDefaultVizPanel(): VizPanel {
  const defaultPluginId = getDefaultPluginId();

  const newPanelTitle = t('dashboard.new-panel-title', 'New panel');

  const datasourceSettings = getDataSourceSrv().getInstanceSettings(null);

  return new VizPanel({
    title: newPanelTitle,
    pluginId: defaultPluginId,
    seriesLimit: config.panelSeriesLimit,
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    hoverHeaderOffset: 0,
    $behaviors: [],
    subHeader: new VizPanelSubHeader({
      hideNonApplicableDrilldowns: !config.featureToggles.perPanelNonApplicableDrilldowns,
    }),
    extendPanelContext: setDashboardPanelContext,
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
    headerActions: new VizPanelHeaderActions({
      hideGroupByAction:
        !config.featureToggles.panelGroupBy && !config.featureToggles.dashboardUnifiedDrilldownControls,
    }),
    $data: datasourceSettings
      ? new SceneDataTransformer({
          $data: new SceneQueryRunner({
            queries: [{ refId: 'A' }],
            datasource: getDataSourceRef(datasourceSettings),
            $behaviors: [new DashboardDatasourceBehaviour({})],
          }),
          transformations: [],
        })
      : undefined,
  });
}

export function isLibraryPanel(vizPanel: VizPanel): boolean {
  return getLibraryPanelBehavior(vizPanel) !== undefined;
}

export function getLibraryPanelBehavior(vizPanel: VizPanel): LibraryPanelBehavior | undefined {
  const behavior = vizPanel.state.$behaviors?.find((behaviour) => behaviour instanceof LibraryPanelBehavior);

  if (behavior) {
    return behavior;
  }

  return undefined;
}

export function calculateGridItemDimensions(repeater: DashboardGridItem) {
  const rowCount = Math.ceil(repeater.getChildCount() / repeater.getMaxPerRow());
  const columnCount = Math.ceil(repeater.getChildCount() / rowCount);
  const w = 24 / columnCount;
  const h = repeater.state.itemHeight ?? 10;
  return { h, w, columnCount };
}

/**
 * Activates any inactive ancestors of the scene object.
 * Useful when rendering a scene object out of context of it's parent
 * @returns
 */
export function activateSceneObjectAndParentTree(so: SceneObject): CancelActivationHandler | undefined {
  let cancel: CancelActivationHandler | undefined;
  let parentCancel: CancelActivationHandler | undefined;

  if (so.isActive) {
    return cancel;
  }

  if (so.parent) {
    parentCancel = activateSceneObjectAndParentTree(so.parent);
  }

  cancel = so.activate();

  return () => {
    parentCancel?.();
    cancel();
  };
}

/**
 * Adaptation of activateSceneObjectAndParentTree specific for PanelSearchLayout use case with
 *   with panelSearch and panelsPerRow custom panel filtering logic.
 *
 * Activating the whole tree because dashboard does not react to variable updates such as panel repeats
 */
export function forceActivateFullSceneObjectTree(so: SceneObject): CancelActivationHandler | undefined {
  let cancel: CancelActivationHandler | undefined;
  let parentCancel: CancelActivationHandler | undefined;

  if (so.parent) {
    parentCancel = forceActivateFullSceneObjectTree(so.parent);
  }

  if (!so.isActive) {
    cancel = so.activate();
    return () => {
      parentCancel?.();
      cancel?.();
    };
  }

  return () => {
    parentCancel?.();
    cancel?.();
  };
}

/**
 * @deprecated use activateSceneObjectAndParentTree instead.
 * Activates any inactive ancestors of the scene object.
 * Useful when rendering a scene object out of context of it's parent
 */
export const activateInActiveParents = activateSceneObjectAndParentTree;

export function getLayoutManagerFor(sceneObject: SceneObject): DashboardLayoutManager {
  let parent = sceneObject.parent;

  while (parent) {
    if (isDashboardLayoutManager(parent)) {
      return parent;
    }
    parent = parent.parent;
  }

  throw new Error('Could not find layout manager for scene object');
}

export function getGridItemKeyForPanelId(panelId: number): string {
  return `grid-item-${panelId}`;
}

export function useDashboard(scene: SceneObject): DashboardScene {
  return getDashboardSceneFor(scene);
}

export function useDashboardState(scene: SceneObject): DashboardSceneState {
  const dashboard = useDashboard(scene);
  return dashboard.useState();
}

export function useInterpolatedTitle<T extends SceneObjectState & { title?: string }>(scene: SceneObject<T>): string {
  const { title } = scene.useState();

  if (!title) {
    return '';
  }

  return sceneGraph.interpolate(scene, title, undefined, 'text');
}

type RepeatableSectionState = SceneObjectState & {
  repeatByVariable?: string;
  repeatSourceKey?: string;
};

export function interpolateSectionTitle<T extends RepeatableSectionState>(
  scene: SceneObject<T>,
  value: string | undefined | null
): string {
  if (value === '' || value == null) {
    return '';
  }

  // Section titles/slugs should resolve in local scene scope so they can
  // use ancestor section variables (including repeat-local variables).
  if (scene.state.repeatByVariable || scene.state.repeatSourceKey) {
    return sceneGraph.interpolate(scene, value, getRepeatLocalScopedVars(scene), 'text');
  }
  return sceneGraph.interpolate(scene, value, undefined, 'text');
}

function getRepeatLocalScopedVars<T extends RepeatableSectionState>(scene: SceneObject<T>): ScopedVars | undefined {
  const variableSet = scene.state.$variables;
  if (!(variableSet instanceof SceneVariableSet)) {
    return undefined;
  }

  const repeatLocalVariable = variableSet.state.variables.find((variable) => variable instanceof LocalValueVariable);
  if (!(repeatLocalVariable instanceof LocalValueVariable)) {
    return undefined;
  }

  return {
    [repeatLocalVariable.state.name]: {
      value: repeatLocalVariable.getValue(),
      text: repeatLocalVariable.state.text,
    },
  };
}

export function getLayoutOrchestratorFor(scene: SceneObject): DashboardLayoutOrchestrator | undefined {
  return getDashboardSceneFor(scene).state.layoutOrchestrator;
}

export const getLayoutForObject = (
  object: DashboardDropTarget | SceneObject<SceneObjectState> | DashboardScene
): AutoGridLayoutManager | DefaultGridLayoutManager | null => {
  const gridManagerForObject = sceneGraph.findObject(
    object,
    (currentSceneObject) =>
      currentSceneObject instanceof AutoGridLayoutManager || currentSceneObject instanceof DefaultGridLayoutManager
  );
  if (
    gridManagerForObject instanceof AutoGridLayoutManager ||
    gridManagerForObject instanceof DefaultGridLayoutManager
  ) {
    return gridManagerForObject;
  }
  return null;
};

// @returns true if the panel is a valid library panel reference
// a valid library panel reference is a panel with this
// property: `libraryPanel: {name: string, uid: string}`

export function isValidLibraryPanelRef(panel: Panel): boolean {
  return (
    (V1_PANEL_PROPERTIES.LIBRARY_PANEL in panel &&
      panel.libraryPanel &&
      Boolean(panel.libraryPanel?.uid && panel.libraryPanel?.name)) ||
    false
  );
}

/**
 * Checks if a V1 dashboard contains library panels
 * @returns true if the dashboard contains library panels
 */
export function hasLibraryPanelsInV1Dashboard(dashboard: Dashboard | undefined): boolean {
  if (!dashboard?.panels) {
    return false;
  }

  return dashboard.panels.some((panel: Panel | RowPanel) => {
    if (isValidLibraryPanelRef(panel)) {
      return true;
    }
    // Check if this is a collapsed row containing library panels
    const isCollapsedRow =
      V1_PANEL_PROPERTIES.COLLAPSED in panel && panel.collapsed && 'panels' in panel && panel.panels;

    if (!isCollapsedRow) {
      return false;
    }

    return panel.panels.some(isValidLibraryPanelRef);
  });
}

export const dashboardLog = createLogger('Dashboard');

/**
 * Checks if there are save changes but not counting time range, refresh rate and default variable value change
 */
export function hasActualSaveChanges(dashboard: DashboardScene) {
  const changes = dashboard.getDashboardChanges();
  return !!changes.diffCount;
}
