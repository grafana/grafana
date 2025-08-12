import { RegistryItem } from '@grafana/data';
import {
  ConditionalRenderingDataKind,
  ConditionalRenderingGroupKind,
  ConditionalRenderingTimeRangeSizeKind,
  ConditionalRenderingVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { ConditionalRenderingData } from './ConditionalRenderingData';
import { ConditionalRenderingGroup } from './ConditionalRenderingGroup';
import { ConditionalRenderingTimeRangeSize } from './ConditionalRenderingTimeRangeSize';
import { ConditionalRenderingVariable } from './ConditionalRenderingVariable';

export type ItemsWithConditionalRendering = 'panel' | 'row' | 'tab' | 'element';

export type DataConditionValue = boolean;

export type GroupConditionVisibility = 'show' | 'hide';
export type GroupConditionCondition = 'and' | 'or';
export type GroupConditionItemType = 'data' | 'timeRangeSize' | 'variable';
export type GroupConditionValue = ConditionalRenderingConditions[];

export type TimeRangeSizeConditionValue = string;

export type VariableConditionValueOperator = '=' | '!=' | '=~' | '!~';

export type VariableConditionValue = {
  name: string;
  operator: VariableConditionValueOperator;
  value: string;
};

export type ConditionValues =
  | DataConditionValue
  | VariableConditionValue
  | GroupConditionValue
  | TimeRangeSizeConditionValue;

export type ConditionalRenderingConditions =
  | ConditionalRenderingData
  | ConditionalRenderingVariable
  | ConditionalRenderingTimeRangeSize
  | ConditionalRenderingGroup;

export type ConditionalRenderingKindTypes =
  | ConditionalRenderingGroupKind
  | ConditionalRenderingVariableKind
  | ConditionalRenderingDataKind
  | ConditionalRenderingTimeRangeSizeKind;

export interface ConditionalRenderingSerializerRegistryItem extends RegistryItem {
  deserialize(model: ConditionalRenderingKindTypes): ConditionalRenderingConditions;
}
