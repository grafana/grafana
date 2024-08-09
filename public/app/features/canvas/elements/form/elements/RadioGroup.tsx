import { useState } from 'react';

import { Stack, Field, RadioButtonList } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface Props extends Omit<FormChild, 'id' | 'type'> {
  title: string;
  onChange: (v: [string, string]) => void;
}

export const RadioGroup = ({ title, options, onChange, currentOption }: Props) => {
  const key = Object.keys(currentOption?.[0] ?? {})[0];
  const [selected, setSelected] = useState(currentOption?.[0][key]);
  return (
    <Field label={title}>
      <Stack direction="column" alignItems="flex-start">
        <RadioButtonList
          name="default"
          value={selected}
          options={options!.map((option) => ({ label: option[0], value: option[1] }))}
          onChange={(value, label) => {
            setSelected(value);
            onChange([label ?? '', value ?? '']);
          }}
        />
      </Stack>
    </Field>
  );
};
