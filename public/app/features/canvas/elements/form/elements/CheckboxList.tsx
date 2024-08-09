import { Stack, Checkbox, Field } from '@grafana/ui';

import { FormChild } from './FormElementTypeEditor';

interface CheckboxProps extends Omit<FormChild, 'id' | 'type'> {
  title: string;
  onChange: (v: [string, string], index: number) => void;
}

export const CheckboxList = ({ title, options, onChange, currentOption }: CheckboxProps) => {
  // get all the keys from the currentOption and values from the currentOption
  const keys = currentOption?.map((item) => Object.keys(item)[0]);
  const values = currentOption?.map((item) => Object.values(item)[0]);

  console.log('currentOption', currentOption);
  console.log({ keys, values });
  console.log({ options });

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
