import { RegistryItemWithOptions } from '../utils/Registry';

import { VariableModel } from './templateVars';
import { TimeRange } from './time';

export interface QueryConditionExecutionContext {
  timeRange: TimeRange;
  variables: VariableModel[];
}

export interface QueryConditionInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  type: QueryConditionType;
  /**
   * Given condition configuration returns boolean representing condition being met or not
   */
  execute: (options: TOptions, context: QueryConditionExecutionContext) => boolean;
  /**
   * Component used to render the condition config
   */
  editor: React.ComponentType<QueryConditionUIProps<TOptions>>;
  /**
   * Returns a string that will be used as a name of a dynamic variable created by this condition
   */
  getVariableName: (options: TOptions) => string;
  /**
   * Prefix used to identify dynamic variables created by this condition
   */
  variablePrefix?: string;
}

export interface QueryConditionUIProps<TOptions = any> {
  options: TOptions;
  onChange: (options: TOptions) => void;
}

export enum QueryConditionID {
  ValueClick = 'value-click',
  TimeRange = 'time-range',
  TimeRangeInterval = 'time-range-interval',
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
