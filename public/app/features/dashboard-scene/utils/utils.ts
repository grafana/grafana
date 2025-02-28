import { getDataSourceRef, IntervalVariableModel } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  CancelActivationHandler,
  CustomVariable,
  MultiValueVariable,
  SceneDataTransformer,
  sceneGraph,
  SceneObject,
  SceneQueryRunner,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import { initialIntervalVariableModelState } from 'app/features/variables/interval/reducer';

import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DashboardLayoutManager, isDashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

import { containsCloneKey, getLastKeyFromClone, getOriginalKey, isInCloneChain } from './clone';

export const NEW_PANEL_HEIGHT = 8;
export const NEW_PANEL_WIDTH = 12;

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

export function getPanelIdForVizPanel(panel: SceneObject): number {
  return parseInt(getOriginalKey(panel.state.key!).replace('panel-', ''), 10);
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

export function findOriginalVizPanelByKey(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  let panel: VizPanel | null = findOriginalVizPanelInternal(scene, key);

  if (panel) {
    return panel;
  }

  // Also try to find by panel id
  const id = parseInt(key, 10);
  if (isNaN(id)) {
    return null;
  }

  const panelId = getVizPanelKeyForPanelId(id);
  panel = findVizPanelInternal(scene, panelId);

  if (panel) {
    return panel;
  }

  panel = findOriginalVizPanelInternal(scene, panelId);

  return panel;
}

function findOriginalVizPanelInternal(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = sceneGraph.findObject(scene, (obj) => {
    const objKey = obj.state.key!;

    // Compare the original keys
    if (objKey === key || (!isInCloneChain(objKey) && getOriginalKey(objKey) === getOriginalKey(key))) {
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

  // First we try to find the non-cloned panel
  // This means it is either in not in a repeat chain or every item in the chain is not a clone
  let panel: SceneObject | null = findOriginalVizPanelByKey(scene, key);
  if (!panel || !panel.state.key) {
    return null;
  }

  // Get the actual panel key, without any of the ancestors
  const panelKey = getLastKeyFromClone(panel.state.key);

  // If the panel contains clone in the key, this means it's a repeated panel, and we need to find the original panel
  if (containsCloneKey(panelKey)) {
    // Get the original key of the panel that we are looking for
    const originalPanelKey = getOriginalKey(panelKey);
    // Start the search from the parent to avoid unnecessary checks
    // The parent usually is the grid item where the referenced panel is also located
    panel = sceneGraph.findObject(panel.parent ?? scene, (sceneObject) => {
      if (!sceneObject.state.key || isInCloneChain(sceneObject.state.key)) {
        return false;
      }

      const currentLastKey = getLastKeyFromClone(sceneObject.state.key);
      if (containsCloneKey(currentLastKey)) {
        return false;
      }

      return getOriginalKey(currentLastKey) === originalPanelKey;
    });
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
export function getIntervalsFromQueryString(query: string): string[] {
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
  const selectedInterval = Array.isArray(variable.current.value) ? variable.current.value[0] : variable.current.value;

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

export function getDefaultVizPanel(): VizPanel {
  return new VizPanel({
    title: 'Panel Title',
    pluginId: 'timeseries',
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    hoverHeaderOffset: 0,
    $behaviors: [],
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
    $data: new SceneDataTransformer({
      $data: new SceneQueryRunner({
        queries: [{ refId: 'A' }],
        datasource: getDataSourceRef(getDataSourceSrv().getInstanceSettings(null)!),
        $behaviors: [new DashboardDatasourceBehaviour({})],
      }),
      transformations: [],
    }),
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
  const rowCount = Math.ceil(repeater.state.repeatedPanels!.length / repeater.getMaxPerRow());
  const columnCount = Math.ceil(repeater.state.repeatedPanels!.length / rowCount);
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
