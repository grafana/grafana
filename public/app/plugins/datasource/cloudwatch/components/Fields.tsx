import { SelectableValue } from '@grafana/data';
import { InlineField, Input, Select } from '@grafana/ui';
import React, { FC, useState } from 'react';

const LABEL_WIDTH = 20;
const TEXT_WIDTH = 100;

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

interface VariableTextFieldProps {
  onBlur: (value: string) => void;
  placeholder: string;
  value: string;
  label: string;
}

export const VariableTextField: FC<VariableTextFieldProps> = ({ label, onBlur, placeholder, value }) => {
  const [localValue, setLocalValue] = useState(value);
  return (
    <InlineField label={label} labelWidth={LABEL_WIDTH}>
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        onBlur={() => onBlur(localValue)}
        width={TEXT_WIDTH}
      />
    </InlineField>
  );
};
