import React, { FC } from 'react';

import { SelectableValue } from '@grafana/data';
import { VirtualizedSelect } from '@grafana/ui';

interface Props {
  onChange: (value: string) => void;
  options: Array<SelectableValue<string>>;
  value?: string;
  addLabel?: string;
  className?: string;
  placeholder?: string;
  custom?: boolean;
  onCustomChange?: (custom: boolean) => void;
  width?: number;
  disabled?: boolean;
  'aria-label'?: string;
}

export const SelectWithAdd: FC<Props> = ({
  value,
  onChange,
  options,
  className,
  placeholder,
  width,
  disabled = false,
  'aria-label': ariaLabel,
}) => {
  return (
    <VirtualizedSelect
      aria-label={ariaLabel}
      width={width}
      options={options}
      allowCustomValue
      value={value}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(val: SelectableValue) => {
        const value = val?.value;
        onChange(value);
      }}
    />
  );
};
