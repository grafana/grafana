import React from 'react';

import { LoadingState } from '@grafana/data';
import { InlineFormLabel, Select } from '@grafana/ui';

import { SceneComponentProps } from '../../core/types';
import { SceneVariable } from '../types';
import { TestVariable } from '../variants/TestVariable';

export function VariableValueSelect({ model }: SceneComponentProps<SceneVariable>) {
  // temp solution, was unable to get the generics right
  const variable = model as TestVariable;
  const { name, value, state, options } = variable.useState();
  const selectOptions = options.map((op) => ({ label: op.text as string, value: op.value as string }));

  return (
    <div className="submenu-item gf-form-inline">
      <InlineFormLabel width="auto">{name}</InlineFormLabel>
      <Select
        value={value}
        width="auto"
        onChange={variable.onValueChange}
        isLoading={state === LoadingState.Loading}
        options={selectOptions}
      />
    </div>
  );
}
