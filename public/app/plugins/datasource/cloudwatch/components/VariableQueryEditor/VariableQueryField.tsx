import { SelectableValue } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import React, { FC } from 'react';

const LABEL_WIDTH = 20;

interface VariableQueryFieldProps {
  onChange: (value: string) => void;
  options: SelectableValue[];
  value: string | null;
  label: string;
  allowCustomValue?: boolean;
  isLoading?: boolean;
  inputId?: string;
}

export const VariableQueryField: FC<VariableQueryFieldProps> = ({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
  isLoading = false,
}) => {
  return (
    <InlineField label={label} labelWidth={LABEL_WIDTH} htmlFor={'inline-field'}>
      <Select
        menuShouldPortal
        aria-label={label}
        width={25}
        allowCustomValue={allowCustomValue}
        value={value}
        onChange={({ value }) => onChange(value!)}
        options={options}
        isLoading={isLoading}
        inputId="inline-field"
      />
    </InlineField>
  );
};
