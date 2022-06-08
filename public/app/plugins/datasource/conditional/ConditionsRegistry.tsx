import React from 'react';

import {
  ConditionID,
  ConditionInfo,
  ConditionType,
  FieldClickArgs,
  FieldClickConditionOptions,
  FieldMatcherID,
  fieldMatchers,
  Registry,
} from '@grafana/data';
import { Input } from '@grafana/ui';

export const fieldClickCondition: ConditionInfo<FieldClickConditionOptions, FieldClickArgs> = {
  id: ConditionID.FieldClick,
  type: ConditionType.Field,
  name: 'field click',
  description: 'When a field is clicked',
  defaultOptions: {},
  evaluate: (options: FieldClickConditionOptions) => (fieldClickArgs) => {
    const regexFieldMatcher = fieldMatchers.get(FieldMatcherID.byRegexp);

    const evaluateRegex = regexFieldMatcher.get(options.pattern);

    return evaluateRegex(fieldClickArgs.field, fieldClickArgs.frame, fieldClickArgs.allFrames);
  },
  editor: ({ onChange, options }) => {
    return (
      <div>
        When field matching pattern is clicked:{' '}
        <Input
          onBlur={(e) => {
            onChange({ ...options, pattern: e.target.value });
          }}
          defaultValue={options.pattern}
        />
      </div>
    );
  },
};

export const conditionsRegistry = new Registry<ConditionInfo>();

export const getConditionItems = () => [fieldClickCondition];
