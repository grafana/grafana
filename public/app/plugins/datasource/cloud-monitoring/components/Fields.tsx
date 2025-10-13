import { SelectableValue } from '@grafana/data';
import { Field, Select } from '@grafana/ui';

interface VariableQueryFieldProps {
  onChange: (value: string) => void;
  options: SelectableValue[];
  value: string;
  label: string;
  allowCustomValue?: boolean;
}

export const VariableQueryField = ({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
}: VariableQueryFieldProps) => {
  return (
    <Field label={label}>
      <Select
        width={25}
        allowCustomValue={allowCustomValue}
        value={value}
        onChange={({ value }) => onChange(value!)}
        options={options}
      />
    </Field>
  );
};
