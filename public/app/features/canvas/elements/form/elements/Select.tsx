import { useState } from 'react';

import { Field, Select } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface Props extends Omit<FormChild, 'id' | 'type'> {
  options: Array<[string, string]>;
  onChange: (newParams: [string, string]) => void;
}

export const SelectDisplay = ({ options, currentOption, onChange, title }: Props) => {
  const [value, setValue] = useState(currentOption?.[1]);

  return (
    <Field label={title} style={{ marginBottom: '2px' }}>
      <Select
        options={options.map((option) => ({ label: option[0], value: option[1] }))}
        value={value}
        onChange={(option) => {
          setValue(option.value);
          onChange([option.label ?? '', option.value ?? '']);
        }}
      />
    </Field>
  );
};
