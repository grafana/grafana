import { useState } from 'react';

import { Stack, Field, RadioButtonList } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface Props extends Omit<FormChild, 'id' | 'type'> {
  title: string;
  onChange: (v: [string, string]) => void;
}

export const RadioList = ({ title, options, onChange, currentOption }: Props) => {
  const key = Object.keys(currentOption?.[0] ?? {})[0];
  const [selected, setSelected] = useState(currentOption?.[0][key]);
  return (
    <Field label={title}>
      <Stack direction="column" alignItems="flex-start">
        <RadioButtonList
          name="default"
          value={selected}
          options={options!.map((option) => ({ label: option[1], value: option[0] }))}
          onChange={(value, label) => {
            setSelected(value);
            onChange([value ?? '', label ?? '']);
          }}
        />
      </Stack>
    </Field>
  );
};
