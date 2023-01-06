import { isArray } from 'lodash';
import React from 'react';

import { MultiSelect, Select } from '@grafana/ui';

import { SceneComponentProps } from '../../core/types';
import { MultiValueVariable } from '../variants/MultiValueVariable';

export function VariableValueSelect({ model }: SceneComponentProps<MultiValueVariable>) {
  const { value, key, loading } = model.useState();

  return (
    <Select
      id={key}
      placeholder="Select value"
      width="auto"
      value={value}
      allowCustomValue
      tabSelectsValue={false}
      isLoading={loading}
      options={model.getOptionsForSelect()}
      onChange={(newValue) => {
        model.changeValueTo(newValue.value!, newValue.label!);
      }}
    />
  );
}

export function VariableValueSelectMulti({ model }: SceneComponentProps<MultiValueVariable>) {
  const { value, key, loading } = model.useState();
  const arrayValue = isArray(value) ? value : [value];

  return (
    <MultiSelect
      id={key}
      placeholder="Select value"
      width="auto"
      value={arrayValue}
      tabSelectsValue={false}
      allowCustomValue
      isLoading={loading}
      options={model.getOptionsForSelect()}
      closeMenuOnSelect={false}
      isClearable={true}
      onOpenMenu={() => {}}
      onChange={(newValue) => {
        model.changeValueTo(
          newValue.map((v) => v.value!),
          newValue.map((v) => v.label!)
        );
      }}
    />
  );
}

export function renderSelectForVariable(model: MultiValueVariable) {
  if (model.state.isMulti) {
    return <VariableValueSelectMulti model={model} />;
  } else {
    return <VariableValueSelect model={model} />;
  }
}
