import React from 'react';

import { ConditionInfo, DataFrame, Field, QueryConditionID, QueryConditionType } from '@grafana/data';
import { Input } from '@grafana/ui';
import { KeyValueVariableModel } from 'app/features/variables/types';

export interface ValueClickConditionOptions {
  pattern: string;
}

export interface ValueClickArgs {
  field: Field;
  frame: DataFrame;
  allFrames: DataFrame[];
}

const FIELD_VALUE_CLICK_VARIABLE_PREFIX = 'valueClick';

export const fieldValueClickCondition: ConditionInfo<ValueClickConditionOptions, ValueClickArgs> = {
  id: QueryConditionID.ValueClick,
  type: QueryConditionType.Field,
  name: 'Field value click',
  description: 'When a value is clicked',
  defaultOptions: {},
  variablePrefix: FIELD_VALUE_CLICK_VARIABLE_PREFIX,
  execute: (options, context) => {
    const drilldownTplVars = context.variables.filter(
      (arg) =>
        (arg as KeyValueVariableModel).id.includes('valueClick') && (arg as KeyValueVariableModel).current.value !== ''
    );

    return (
      drilldownTplVars.filter((arg) => {
        const result = (arg as KeyValueVariableModel).name.replace('valueClick', '').match(options.pattern);

        return result;
      }).length !== 0
    );
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
    return `${FIELD_VALUE_CLICK_VARIABLE_PREFIX}${options.pattern}`;
  },
};
