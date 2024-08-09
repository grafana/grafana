import { useState } from 'react';

import { Field, Input } from '@grafana/ui';

import { TextInputProps } from './TextInput';

export const NumberInputEditor = ({ onChange, currentOption }: TextInputProps) => {
  const key = Object.keys(currentOption?.[0] ?? {})[0];
  const [value, setValue] = useState(key);

  return (
    <Field label="Number input title">
      <Input
        defaultValue={value}
        onBlur={(event) => {
          setValue(event.currentTarget.value);
          onChange(event.currentTarget.value === '' ? key : event.currentTarget.value);
        }}
        required
      />
    </Field>
  );
};
