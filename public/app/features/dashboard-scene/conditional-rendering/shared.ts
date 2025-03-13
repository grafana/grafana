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

type NonGroupConditions = Exclude<ConditionalRenderingConditions, ConditionalRenderingGroup>;

export const handleDeleteNonGroupCondition = (model: NonGroupConditions) => {
  if (model.parent instanceof ConditionalRenderingGroup) {
    model.parent.setState({ value: model.parent.state.value.filter((condition) => condition !== model) });
    model.getConditionalLogicRoot().notifyChange();
  }
};
