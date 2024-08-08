import { Stack, Checkbox as CheckboxGrafanaUI, Field } from '@grafana/ui';

interface CheckboxProps {
  title: string;
  options: Array<{ [key: string]: string }>;
  onChange: (v: [string, string], index: number) => void;
}

export const Checkbox = ({ title, options, onChange }: CheckboxProps) => {
  return (
    <Field label={title}>
      <Stack direction="column" alignItems="flex-start">
        {options.map((item, i) => {
          const key = Object.keys(item)[0];
          return (
            <CheckboxGrafanaUI
              key={i}
              defaultChecked={item[key] === 'true'}
              label={key}
              onChange={(e) => onChange([item[key], e.currentTarget.checked ? 'true' : 'false'], i)}
            />
          );
        })}
      </Stack>
    </Field>
  );
};
