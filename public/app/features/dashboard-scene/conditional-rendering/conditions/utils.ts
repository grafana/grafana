import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';
import { extractObjectType, type ObjectsWithConditionalRendering } from '../object';

import { type ConditionalRenderingConditions } from './types';

export function getGroup(condition: ConditionalRenderingConditions): ConditionalRenderingGroup | undefined {
  if (condition.parent instanceof ConditionalRenderingGroup) {
    return condition.parent;
  }

  try {
    return sceneGraph.getAncestor(condition, ConditionalRenderingGroup);
  } catch {
    // Condition may be owned by a DashboardRule instead of a ConditionalRenderingGroup
    return undefined;
  }
}

export function getObject(condition: ConditionalRenderingConditions): SceneObject | undefined {
  const group = getGroup(condition);

  if (!group) {
    return condition.parent;
  }

  const groupTarget = group.getTarget();
  return groupTarget ?? group.parent;
}

export function getObjectType(condition: ConditionalRenderingConditions): ObjectsWithConditionalRendering {
  return extractObjectType(getObject(condition));
}

export function removeCondition(condition: ConditionalRenderingConditions) {
  getGroup(condition)?.removeCondition(condition);
}

export function undoRemoveCondition(condition: ConditionalRenderingConditions, index: number) {
  getGroup(condition)?.undoRemoveCondition(condition, index);
}

export function getConditionIndex(condition: ConditionalRenderingConditions): number {
  return getGroup(condition)?.getConditionIndex(condition) ?? -1;
}

export function checkGroup(condition: ConditionalRenderingConditions) {
  getGroup(condition)?.check();
}
