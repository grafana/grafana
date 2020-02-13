import React, { useState } from 'react';
import { IconType } from '../Icon/types';
import { SelectableValue } from '@grafana/data';
import { Button, ButtonVariant } from '../Forms/Button';
import { Select } from '../Forms/Select/Select';

interface ValuePickerProps<T> {
  /** Label to display on the picker button */
  label: string;
  /** Icon to display on the picker button */
  icon?: IconType;
  /** ValuePicker options  */
  options: Array<SelectableValue<T>>;
  onChange: (value: SelectableValue<T>) => void;
  variant?: ButtonVariant;
}

export function ValuePicker<T>({ label, icon, options, onChange, variant }: ValuePickerProps<T>) {
  const [isPicking, setIsPicking] = useState(false);

  return (
    <>
      {!isPicking && (
        <Button onClick={() => setIsPicking(true)} variant={variant} icon={`fa fa-${icon}`}>
          {label}
        </Button>
      )}

      {isPicking && (
        <Select
          placeholder={label}
          options={options}
          isOpen
          onCloseMenu={() => setIsPicking(false)}
          autoFocus={true}
          onChange={value => {
            setIsPicking(false);
            onChange(value);
          }}
        />
      )}
    </>
  );
}
