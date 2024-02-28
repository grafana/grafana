import React from 'react';

import { Input } from '@grafana/ui/src/components/Input/Input';

type NumberInputProps = {
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
  width: number;
};

export function NumberInput({ value, defaultValue, onChange, width }: NumberInputProps) {
  const [isEmpty, setIsEmpty] = React.useState(false);
  return (
    <Input
      type="number"
      placeholder={String(defaultValue)}
      value={isEmpty ? '' : value}
      onChange={(e) => {
        if (e.currentTarget.value?.trim() === '') {
          setIsEmpty(true);
          onChange(defaultValue);
        } else {
          setIsEmpty(false);
          const newVal = Number(e.currentTarget.value);
          if (!Number.isNaN(newVal)) {
            onChange(newVal);
          }
        }
      }}
      width={width}
    />
  );
}
