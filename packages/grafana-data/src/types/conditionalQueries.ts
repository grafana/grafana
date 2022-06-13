import { RegistryItemWithOptions } from '../utils/Registry';

import { VariableModel } from './templateVars';
import { TimeRange } from './time';

export interface QueryConditionExecutionContext {
  timeRange: TimeRange;
  variables: VariableModel[];
}

export interface ConditionInfo<TOptions = any, TArgs = any> extends RegistryItemWithOptions {
  type: QueryConditionType;
  execute: (options: TOptions, context: QueryConditionExecutionContext) => boolean;
  evaluate: (options: TOptions) => (args: TArgs) => boolean;
  editor: React.ComponentType<ConditionUIProps<TOptions>>;
  getVariableName: (options: TOptions) => string;
}

export interface ConditionUIProps<TOptions = any> {
  options: TOptions;
  onChange: (options: TOptions) => void;
}

export enum QueryConditionID {
  ValueClick = 'value-click',
  TimeRange = 'time-range',
}

export enum QueryConditionType {
  Field = 'field',
  TimeRange = 'time-range',
}

export type QueryConditionConfig = {
  id: QueryConditionID;
  options: any;
};

export type QueryConditions = QueryConditionConfig[];
