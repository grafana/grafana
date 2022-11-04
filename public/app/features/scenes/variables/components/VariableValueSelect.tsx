import { isArray } from 'lodash';
import React from 'react';

import { Select, MultiSelect } from '@grafana/ui';

import { SceneComponentProps } from '../../core/types';
import { MultiValueVariable } from '../variants/MultiValueVariable';

export function VariableValueSelect({ model }: SceneComponentProps<MultiValueVariable>) {
  const { value, key, loading, isMulti, options } = model.useState();

  if (isMulti) {
    return (
      <MultiSelect
        id={key}
        placeholder="Select value"
        width="auto"
        value={isArray(value) ? value : [value]}
        allowCustomValue
        isLoading={loading}
        options={options}
        onChange={model.onMultiValueChange}
      />
    );
  }

  return (
    <Select
      id={key}
      placeholder="Select value"
      width="auto"
      value={value}
      allowCustomValue
      isLoading={loading}
      options={options}
      onChange={model.onSingleValueChange}
    />
  );
}
