import React, { useState } from 'react';

import { EditorField } from '@grafana/experimental';
import { InlineField, Input, PopoverContent } from '@grafana/ui';

import { removeMarginBottom } from '../styles';

const LABEL_WIDTH = 20;

interface Props {
  onBlur: (value: string) => void;
  value: string;
  label: string;
  placeholder?: string;
  tooltip?: PopoverContent;
  interactive?: boolean;
  newFormStylingEnabled?: boolean;
}

export const VariableTextField = ({
  interactive,
  label,
  onBlur,
  placeholder,
  value,
  tooltip,
  newFormStylingEnabled,
}: Props) => {
  const [localValue, setLocalValue] = useState(value);
  return newFormStylingEnabled ? (
    <EditorField label={label} tooltip={tooltip} tooltipInteractive={interactive} className={removeMarginBottom}>
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        onBlur={() => onBlur(localValue)}
      />
    </EditorField>
  ) : (
    <InlineField interactive={interactive} label={label} labelWidth={LABEL_WIDTH} tooltip={tooltip} grow>
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        onBlur={() => onBlur(localValue)}
        width={25}
      />
    </InlineField>
  );
};
