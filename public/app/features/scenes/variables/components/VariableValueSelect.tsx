import React from 'react';

import { LoadingState, VariableHide } from '@grafana/data';
import { AsyncSelect, ClickOutsideWrapper, Select } from '@grafana/ui';
import { VariableInput } from 'app/features/variables/pickers/shared/VariableInput';
import { VariableLink } from 'app/features/variables/pickers/shared/VariableLink';
import VariableOptions from 'app/features/variables/pickers/shared/VariableOptions';

import { SceneComponentProps } from '../../core/types';
import { MultiValueVariable } from '../variants/MultiValueVariable';

export function VariableValueSelect({ model }: SceneComponentProps<MultiValueVariable>) {
  const { value, key, state, isMulti, options } = model.useState();

  return (
    <Select
      id={key}
      placeholder="Select value"
      width="auto"
      value={value}
      allowCustomValue
      isLoading={state === LoadingState.Loading}
      options={options}
      onChange={model.onValueChange}
    />
  );
}
