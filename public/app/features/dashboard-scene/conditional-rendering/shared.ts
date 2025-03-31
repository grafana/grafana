import { ConditionalRenderingData, DataConditionValue } from './ConditionalRenderingData';
import { ConditionalRenderingGroup, GroupConditionValue } from './ConditionalRenderingGroup';
import { ConditionalRenderingInterval, IntervalConditionValue } from './ConditionalRenderingInterval';
import { ConditionalRenderingVariable, VariableConditionValue } from './ConditionalRenderingVariable';

export type ConditionValues =
  | DataConditionValue
  | VariableConditionValue
  | GroupConditionValue
  | IntervalConditionValue;

export type ConditionalRenderingConditions =
  | ConditionalRenderingData
  | ConditionalRenderingVariable
  | ConditionalRenderingInterval
  | ConditionalRenderingGroup;
