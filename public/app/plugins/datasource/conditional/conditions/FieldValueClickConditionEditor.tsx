import { capitalize } from 'lodash';
import React, { useState } from 'react';

import { Field, HorizontalGroup, Input } from '@grafana/ui';

import { QueryConditionUIProps } from '../types';

export interface ValueClickConditionOptions {
  pattern: string;
  name: string;
}
export const FieldValueClickConditionEditor: React.FC<QueryConditionUIProps<ValueClickConditionOptions>> = ({
  onChange,
  options,
}) => {
  const [dynamicVariableTmp, setDynamicVariableTmp] = useState(options.name);
  const dynamicVariable = dynamicVariableTmp ? '${valueClick' + `${capitalize(dynamicVariableTmp)}}` : '';

  return (
    <HorizontalGroup spacing="md">
      <Field
        label="Condition ID"
        description={
          dynamicVariable ? (
            <>
              Reference value in query by using <strong>{dynamicVariable}</strong>
            </>
          ) : (
            'Will be used as a dynamic template variable name'
          )
        }
      >
        <Input
          onBlur={(e) => {
            onChange({ ...options, name: e.target.value });
          }}
          onChange={(e) => {
            setDynamicVariableTmp(e.currentTarget.value);
          }}
          defaultValue={options.name}
          placeholder="ID"
        />
      </Field>

      <Field label="Match fields" description="Provide a pattern to match field names that will become interactive">
        <Input
          onBlur={(e) => {
            onChange({ ...options, pattern: e.target.value });
          }}
          defaultValue={options.pattern}
          placeholder="Field name"
        />
      </Field>
    </HorizontalGroup>
  );
};
