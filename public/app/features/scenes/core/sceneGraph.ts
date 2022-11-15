import { getDefaultTimeRange, LoadingState } from '@grafana/data';

import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { SceneVariables } from '../variables/types';

import { SceneDataNode } from './SceneDataNode';
import { SceneTimeRange as SceneTimeRangeImpl } from './SceneTimeRange';
import { SceneDataState, SceneEditor, SceneObject, SceneTimeRange } from './types';

/**
 * Get the closest node with variables
 */
export function getVariablesFor(sceneObject: SceneObject): SceneVariables {
  if (sceneObject.state.$variables) {
    return sceneObject.state.$variables;
  }

  if (sceneObject.parent) {
    return getVariablesFor(sceneObject.parent);
  }

  return EmptyVariableSet;
}

/**
 * Will walk up the scene object graph to the closest $data scene object
 */
export function getDataFor(sceneObject: SceneObject): SceneObject<SceneDataState> {
  const { $data } = sceneObject.state;
  if ($data) {
    return $data;
  }

  if (sceneObject.parent) {
    return getDataFor(sceneObject.parent);
  }

  return EmptyDataNode;
}

/**
 * Will walk up the scene object graph to the closest $timeRange scene object
 */
export function getTimeRangeFor(sceneObject: SceneObject): SceneTimeRange {
  const { $timeRange } = sceneObject.state;
  if ($timeRange) {
    return $timeRange;
  }

  if (sceneObject.parent) {
    return getTimeRangeFor(sceneObject.parent);
  }

  return DefaultTimeRange;
}

/**
 * Will walk up the scene object graph to the closest $editor scene object
 */
export function getSceneEditorFor(sceneObject: SceneObject): SceneEditor {
  const { $editor } = sceneObject.state;
  if ($editor) {
    return $editor;
  }

  if (sceneObject.parent) {
    return getSceneEditorFor(sceneObject.parent);
  }

  throw new Error('No editor found in scene tree');
}

export const EmptyVariableSet = new SceneVariableSet({ variables: [] });

export const EmptyDataNode = new SceneDataNode({
  data: {
    state: LoadingState.Done,
    series: [],
    timeRange: getDefaultTimeRange(),
  },
});

export const DefaultTimeRange = new SceneTimeRangeImpl(getDefaultTimeRange());

export const sceneGraph = {
  getVariablesFor,
  getDataFor,
  getTimeRangeFor,
  getSceneEditorFor,
};
