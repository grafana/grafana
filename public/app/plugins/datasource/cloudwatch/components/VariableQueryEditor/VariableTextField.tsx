import { InlineField, Input } from '@grafana/ui';
import React, { FC, useState } from 'react';

const LABEL_WIDTH = 20;

interface VariableTextFieldProps {
  onBlur: (value: string) => void;
  placeholder: string;
  value: string;
  label: string;
  tooltip?: string;
}

export const VariableTextField: FC<VariableTextFieldProps> = ({ label, onBlur, placeholder, value, tooltip }) => {
  const [localValue, setLocalValue] = useState(value);
  return (
    <InlineField label={label} labelWidth={LABEL_WIDTH} tooltip={tooltip} grow={true}>
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        onBlur={() => onBlur(localValue)}
      />
    </InlineField>
  );
};
