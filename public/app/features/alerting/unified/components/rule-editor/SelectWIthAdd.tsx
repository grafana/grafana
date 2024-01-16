import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Input, Select } from '@grafana/ui';

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
  getOptionLabel?: ((item: SelectableValue<string>) => React.ReactNode) | undefined;
}

export const SelectWithAdd = ({
  value,
  onChange,
  options,
  className,
  placeholder,
  width,
  custom,
  onCustomChange,
  disabled = false,
  addLabel = '+ Add new',
  'aria-label': ariaLabel,
  getOptionLabel,
}: Props) => {
  const [isCustom, setIsCustom] = useState(custom);

  useEffect(() => {
    setIsCustom(custom);
  }, [custom]);

  const _options = useMemo(
    (): Array<SelectableValue<string>> => [...options, { value: '__add__', label: addLabel }],
    [options, addLabel]
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && isCustom) {
      inputRef.current.focus();
    }
  }, [isCustom]);

  if (isCustom) {
    return (
      <Input
        aria-label={ariaLabel}
        width={width}
        autoFocus={!custom}
        value={value || ''}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        ref={inputRef}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  } else {
    return (
      <Select
        aria-label={ariaLabel}
        width={width}
        options={_options}
        value={value}
        className={className}
        placeholder={placeholder}
        getOptionLabel={getOptionLabel}
        disabled={disabled}
        onChange={(val: SelectableValue) => {
          const value = val?.value;
          if (value === '__add__') {
            setIsCustom(true);
            if (onCustomChange) {
              onCustomChange(true);
            }
            onChange('');
          } else {
            onChange(value);
          }
        }}
      />
    );
  }
};
