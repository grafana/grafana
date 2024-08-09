import { useState } from 'react';

import { Field, Input } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface NumberInputProps extends Omit<FormChild, 'id' | 'type'> {
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}

export const NumberInput = ({ title, onChange, min, max, placeholder, currentOption }: NumberInputProps) => {
  const key = Object.keys(currentOption?.[0] ?? {})[0];
  const [value, setValue] = useState(currentOption?.[0][key]);

  return (
    <Field label={title}>
      <Input
        type="number"
        defaultValue={value}
        onBlur={(e) => {
          setValue(e.currentTarget.value);
          onChange(e.currentTarget.value);
        }}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </Field>
  );
};
