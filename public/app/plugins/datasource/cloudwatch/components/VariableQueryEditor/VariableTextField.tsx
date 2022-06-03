import React, { FC, useState } from 'react';

import { InlineField, Input } from '@grafana/ui';

const LABEL_WIDTH = 20;
const TEXT_WIDTH = 100;

interface VariableTextFieldProps {
  onBlur: (value: string) => void;
  value: string;
  label: string;
  tooltip?: string;
  placeholder?: string;
}

export const VariableTextField: FC<VariableTextFieldProps> = ({ label, onBlur, placeholder, value, tooltip }) => {
  const [localValue, setLocalValue] = useState(value);
  return (
    <InlineField label={label} labelWidth={LABEL_WIDTH} tooltip={tooltip}>
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
