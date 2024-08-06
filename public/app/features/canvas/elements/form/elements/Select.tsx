import { useState } from 'react';

import { Select } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface Props extends Omit<FormChild, 'id' | 'type'> {
  options: Array<[string, string]>;
  onChange: (newParams: [string, string]) => void;
}

export const SelectDisplay = ({ options, currentOption, onChange }: Props) => {
  const [value, setValue] = useState(currentOption?.[1]);

  return (
    <Select
      options={options.map((option) => ({ label: option[0], value: option[1] }))}
      value={value}
      onChange={(option) => {
        setValue(option.value);
        onChange([option.label ?? '', option.value ?? '']);
      }}
    />
  );
};
