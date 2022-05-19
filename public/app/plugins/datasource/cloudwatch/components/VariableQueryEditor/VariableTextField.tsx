import React, { FC, useState } from 'react';

import { InlineField, Input, PopoverContent } from '@grafana/ui';

const LABEL_WIDTH = 20;

interface VariableTextFieldProps {
  onBlur: (value: string) => void;
  placeholder: string;
  value: string;
  label: string;
  tooltip?: PopoverContent;
  interactive?: boolean;
}

export const VariableTextField: FC<VariableTextFieldProps> = ({
  interactive,
  label,
  onBlur,
  placeholder,
  value,
  tooltip,
}) => {
  const [localValue, setLocalValue] = useState(value);
  return (
    <InlineField interactive={interactive} label={label} labelWidth={LABEL_WIDTH} tooltip={tooltip} grow>
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
