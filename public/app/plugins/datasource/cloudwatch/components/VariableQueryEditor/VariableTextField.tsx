import { useState } from 'react';

import { EditorField } from '@grafana/plugin-ui';
import { Input, PopoverContent } from '@grafana/ui';

import { removeMarginBottom } from '../styles';

interface Props {
  onBlur: (value: string) => void;
  value: string;
  label: string;
  placeholder?: string;
  tooltip?: PopoverContent;
  interactive?: boolean;
}

export const VariableTextField = ({ interactive, label, onBlur, placeholder, value, tooltip }: Props) => {
  const [localValue, setLocalValue] = useState(value);
  return (
    <EditorField label={label} tooltip={tooltip} tooltipInteractive={interactive} className={removeMarginBottom}>
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        onBlur={() => onBlur(localValue)}
      />
    </EditorField>
  );
};
