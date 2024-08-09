import { Stack, Checkbox, Field } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface CheckboxProps extends Omit<FormChild, 'id' | 'type'> {
  title: string;
  onChange: (v: [string, string], index: number) => void;
}

export const CheckboxList = ({ title, options, onChange, currentOption }: CheckboxProps) => {
  const values = currentOption?.map((item) => Object.values(item)[0]);

  return (
    <Field label={title}>
      <Stack direction="column" alignItems="flex-start">
        {options!.map((item, i) => {
          return (
            <Checkbox
              key={i}
              defaultChecked={values![i] === 'true'}
              label={item[0]}
              onChange={(e) => onChange([item[1], e.currentTarget.checked ? 'true' : 'false'], i)}
            />
          );
        })}
      </Stack>
    </Field>
  );
};
