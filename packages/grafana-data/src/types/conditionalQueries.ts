import { RegistryItemWithOptions } from '../utils/Registry';

import { DataFrame, Field } from './dataFrame';

export interface ConditionInfo<TOptions = any, TArgs = any> extends RegistryItemWithOptions {
  type: ConditionType;
  evaluate: (options: TOptions) => (args: TArgs) => boolean;
  editor: React.ComponentType<ConditionUIProps<TOptions>>;
}

export interface FieldClickConditionOptions {
  pattern: string;
}

export interface FieldClickArgs {
  field: Field;
  frame: DataFrame;
  allFrames: DataFrame[];
}

export interface ConditionUIProps<TOptions = any> {
  options: TOptions;
  onChange: (options: TOptions) => void;
}

export enum ConditionID {
  FieldClick = 'field-click',
}

export enum ConditionType {
  Field = 'field',
}

export type QueryConditions = Array<{
  id: ConditionID;
  options: any;
}>;
