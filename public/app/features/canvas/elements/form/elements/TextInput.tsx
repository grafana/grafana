import { useState } from 'react';

import { Field, Input } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

export interface TextInputProps extends Omit<FormChild, 'id' | 'type'> {
  onChange: (value: string) => void;
}

export const TextInput = ({ title, onChange, currentOption }: TextInputProps) => {
  const [value, setValue] = useState(currentOption?.[1]);

  return (
    <Field label={title}>
      <Input
        defaultValue={value}
        onBlur={(event) => {
          setValue(event.currentTarget.value);
          onChange(event.currentTarget.value);
        }}
      />
    </Field>
  );
};
