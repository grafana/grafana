import { useState } from 'react';

import { Input } from '@grafana/ui';

import { TextInputProps } from './TextInput';

export const TextInputEditor = ({ title, onChange, currentOption }: TextInputProps) => {
  const [value, setValue] = useState(currentOption?.[0]);

  return (
    <Input
      defaultValue={value}
      onBlur={(event) => {
        setValue(event.currentTarget.value);
        onChange(event.currentTarget.value);
      }}
    />
  );
};
