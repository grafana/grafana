import { NestedScene, SceneCollapser } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimeShiftNode } from '../components/SceneTimeShiftNode';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneDataNode } from './SceneDataNode';
import { SceneDataProviderNode } from './SceneDataProviderNode';
import { SceneTimeRange } from './SceneTimeRange';
import { SceneDataTransformationNode } from './SceneTransformationNode';
import { SceneLayoutState, SceneObject, SceneObjectStatePlain, SceneParametrizedState } from './types';

export function isLayoutState(state: object): state is SceneLayoutState {
  return Object.prototype.hasOwnProperty.call(state, 'children');
}

export function isParametrizedState(
  state: object
): state is SceneParametrizedState<Record<string, SceneObject<SceneObjectStatePlain>>> {
  return Object.prototype.hasOwnProperty.call(state, 'inputParams');
}
export function isDataProviderNode(node: SceneObject): node is SceneDataProviderNode {
  return node instanceof SceneDataProviderNode;
}

export function isFlexChildNode(node: SceneObject): node is SceneFlexChild {
  return node instanceof SceneFlexChild;
}

export function isTimeRangeNode(node: SceneObject): node is SceneTimeRange {
  return node instanceof SceneTimeRange;
}

export function isDataNode(node: SceneObject): boolean {
  return (
    node instanceof SceneTimeRange ||
    node instanceof SceneDataProviderNode ||
    node instanceof SceneDataTransformationNode ||
    node instanceof SceneDataNode ||
    node instanceof SceneTimeShiftNode
  );
}

export function isLayoutNode(node: SceneObject): boolean {
  return (
    node instanceof Scene ||
    node instanceof SceneFlexLayout ||
    node instanceof SceneFlexChild ||
    node instanceof NestedScene ||
    node instanceof SceneCollapser ||
    node instanceof SceneToolbar ||
    node instanceof VizPanel
  );
}
