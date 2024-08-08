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
  const [value, setValue] = useState(currentOption?.[1]!);

  return (
    <Field label={title}>
      <Input
        type="number"
        value={value}
        onBlur={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </Field>
  );
};
