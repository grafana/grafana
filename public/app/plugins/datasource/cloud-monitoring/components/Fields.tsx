import React, { FunctionComponent } from 'react';
import { Select, InlineField } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

interface VariableQueryFieldProps {
  onChange: (value: string) => void;
  options: SelectableValue[];
  value: string;
  label: string;
  allowCustomValue?: boolean;
}

export const VariableQueryField: FunctionComponent<VariableQueryFieldProps> = ({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
}) => {
  return (
    <InlineField label={label} labelWidth={20}>
      <Select
        width={25}
        allowCustomValue={allowCustomValue}
        value={value}
        onChange={({ value }) => onChange(value!)}
        options={options}
      />
    </InlineField>
  );
};
