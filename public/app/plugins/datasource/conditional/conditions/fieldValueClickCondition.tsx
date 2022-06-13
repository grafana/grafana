import React from 'react';

import {
  ConditionInfo,
  DataFrame,
  Field,
  FieldMatcherID,
  fieldMatchers,
  QueryConditionID,
  QueryConditionType,
} from '@grafana/data';
import { Input } from '@grafana/ui';
import { ConstantVariableModel } from 'app/features/variables/types';

export interface ValueClickConditionOptions {
  pattern: string;
}

export interface ValueClickArgs {
  field: Field;
  frame: DataFrame;
  allFrames: DataFrame[];
}

export const fieldValueClickCondition: ConditionInfo<ValueClickConditionOptions, ValueClickArgs> = {
  id: QueryConditionID.ValueClick,
  type: QueryConditionType.Field,
  name: 'Field value click',
  description: 'When a value is clicked',
  defaultOptions: {},
  execute: (options, context) => {
    const drilldownTplVars = context.variables.filter((arg) =>
      (arg as ConstantVariableModel).id.includes('valueClick')
    );

    return (
      drilldownTplVars.filter((arg) => {
        const result = (arg as ConstantVariableModel).name
          // TODO: refactor this fixed string
          .replace('valueClick', '')
          .match(options.pattern);

        return result;
      }).length !== 0
    );
  },
  evaluate: (options: ValueClickConditionOptions) => (fieldClickArgs) => {
    const regexFieldMatcher = fieldMatchers.get(FieldMatcherID.byRegexp);

    const evaluateRegex = regexFieldMatcher.get(options.pattern);

    return evaluateRegex(fieldClickArgs.field, fieldClickArgs.frame, fieldClickArgs.allFrames);
  },
  editor: ({ onChange, options }) => {
    return (
      <Input
        onBlur={(e) => {
          onChange({ ...options, pattern: e.target.value });
        }}
        defaultValue={options.pattern}
        placeholder="Field name"
      />
    );
  },
  getVariableName: (options: ValueClickConditionOptions) => {
    return `valueClick${options.pattern}`;
  },
};
