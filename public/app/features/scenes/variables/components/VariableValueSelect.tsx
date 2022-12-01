import { isArray } from 'lodash';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { MultiSelect, Select } from '@grafana/ui';

import { SceneComponentProps } from '../../core/types';
import { VariableValueSingle } from '../types';
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
  const [selectValue, setSelectValue] = React.useState(arrayValue);

  return (
    <MultiSelect
      id={key}
      placeholder="Select value"
      width="auto"
      value={selectValue}
      tabSelectsValue={false}
      allowCustomValue
      isLoading={loading}
      options={model.getOptionsForSelect()}
      closeMenuOnSelect={false}
      isClearable={true}
      onOpenMenu={() => {}}
      onBlur={() => {
        model.changeValueTo(selectValue);
      }}
      onChange={(newValue: Array<SelectableValue<VariableValueSingle>>) => {
        setSelectValue(newValue.map((v) => v.value!));
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
