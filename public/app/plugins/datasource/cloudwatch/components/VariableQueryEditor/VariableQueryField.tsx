import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, Select } from '@grafana/ui';

import { VariableQueryType } from '../../types';

const LABEL_WIDTH = 20;

interface VariableQueryFieldProps<T> {
  onChange: (value: T) => void;
  options: SelectableValue[];
  value: T | null;
  label: string;
  inputId?: string;
  allowCustomValue?: boolean;
  isLoading?: boolean;
}

export const VariableQueryField = <T extends string | VariableQueryType>({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
  isLoading = false,
  inputId = label,
}: VariableQueryFieldProps<T>) => {
  return (
    <InlineField label={label} labelWidth={LABEL_WIDTH} htmlFor={inputId}>
      <Select
        aria-label={label}
        width={25}
        allowCustomValue={allowCustomValue}
        value={value}
        onChange={({ value }) => onChange(value!)}
        options={options}
        isLoading={isLoading}
        inputId={inputId}
      />
    </InlineField>
  );
};
