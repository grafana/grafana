import { SelectableValue } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';
import React from 'react';
import { VariableQueryType } from '../../types';

const LABEL_WIDTH = 20;

interface VariableQueryFieldProps<T> {
  onChange: (value: T) => void;
  options: SelectableValue[];
  value: T | null;
  label: string;
  allowCustomValue?: boolean;
  isLoading?: boolean;
  inputId?: string;
}

export const VariableQueryField = <T extends string | VariableQueryType>({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
  isLoading = false,
}: VariableQueryFieldProps<T>) => {
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
