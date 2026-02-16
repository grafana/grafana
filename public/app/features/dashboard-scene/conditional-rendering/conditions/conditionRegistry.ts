import { Registry, RegistryItem } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import {
  ConditionalRenderingDataKind,
  ConditionalRenderingTimeRangeSizeKind,
  ConditionalRenderingUserTeamKind,
  ConditionalRenderingVariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { ObjectsWithConditionalRendering } from '../object';

import { ConditionalRenderingConditions } from './types';

/** Union of all condition kind types from the dashboard schema. */
export type ConditionalRenderingConditionsKindTypes =
  | ConditionalRenderingVariableKind
  | ConditionalRenderingDataKind
  | ConditionalRenderingTimeRangeSizeKind
  | ConditionalRenderingUserTeamKind;

/**
 * Defines a condition type that can be registered in the condition registry.
 * Each condition type provides its own deserialization, factory, editor (via SceneObject Component),
 * and applicability logic. New condition types can be added by registering a ConditionRegistryItem
 * without modifying core conditional rendering code.
 */
export interface ConditionRegistryItem extends RegistryItem {
  /** Deserialize a condition from its schema kind representation. */
  deserialize(model: ConditionalRenderingConditionsKindTypes): ConditionalRenderingConditions;
  /** Create a new empty condition, optionally using the scene graph for context (e.g. variable names). */
  createEmpty(scene: SceneObject): ConditionalRenderingConditions;
  /** When true, the element should remain mounted (render hidden) so it can provide data. */
  requiresRenderHidden?: boolean;
  /** Return false to exclude this condition from the add menu for a given element type. */
  isApplicable?: (objectType: ObjectsWithConditionalRendering) => boolean;
}

export const conditionRegistry = new Registry<ConditionRegistryItem>();
