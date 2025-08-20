import { sceneGraph, SceneObject } from '@grafana/scenes';

import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';
import { getObjectType as getObjectTypeGlobal, ObjectsWithConditionalRendering } from '../object';

import { ConditionalRenderingConditions } from './types';

export function getGroup(condition: ConditionalRenderingConditions): ConditionalRenderingGroup {
  if (condition.parent instanceof ConditionalRenderingGroup) {
    return condition.parent;
  }

  return sceneGraph.getAncestor(condition, ConditionalRenderingGroup);
}

export function getObject(condition: ConditionalRenderingConditions): SceneObject | undefined {
  return getGroup(condition).parent;
}

export function getObjectType(condition: ConditionalRenderingConditions): ObjectsWithConditionalRendering {
  return getObjectTypeGlobal(getObject(condition));
}

export function removeCondition(condition: ConditionalRenderingConditions) {
  getGroup(condition).removeCondition(condition);
}

export function undoRemoveCondition(condition: ConditionalRenderingConditions, index: number) {
  getGroup(condition).undoRemoveCondition(condition, index);
}

export function getConditionIndex(condition: ConditionalRenderingConditions): number {
  return getGroup(condition).getConditionIndex(condition);
}

export function checkGroup(condition: ConditionalRenderingConditions) {
  getGroup(condition).check();
}
