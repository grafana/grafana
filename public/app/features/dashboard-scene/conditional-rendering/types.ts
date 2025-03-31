import { RegistryItem } from '@grafana/data';
import {
  ConditionalRenderingDataKind,
  ConditionalRenderingGroupKind,
  ConditionalRenderingTimeIntervalKind,
  ConditionalRenderingVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionalRenderingInterval } from './ConditionalRenderingInterval';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

export type DataConditionValue = boolean;

export type GroupConditionOutcome = 'show' | 'hide';
export type GroupConditionCondition = 'and' | 'or';
export type GroupConditionItemType = 'data' | 'interval' | 'variable';
export type GroupConditionValue = ConditionalRenderingConditions[];

export type IntervalConditionValue = string;

export type VariableConditionValueOperator = '=' | '!=';

export type VariableConditionValue = {
  name: string;
  operator: VariableConditionValueOperator;
  value: string;
};

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

export type ConditionalRenderingKindTypes =
  | ConditionalRenderingGroupKind
  | ConditionalRenderingVariableKind
  | ConditionalRenderingDataKind
  | ConditionalRenderingTimeIntervalKind;

export interface ConditionalRenderingSerializerRegistryItem extends RegistryItem {
  deserialize(model: ConditionalRenderingKindTypes): ConditionalRenderingConditions;
}
