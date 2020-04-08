import React, { useState } from 'react';
import { IconName } from '../../types';
import { SelectableValue } from '@grafana/data';
import { Button, ButtonVariant } from '../Button';
import { Select } from '../Select/Select';
import { FullWidthButtonContainer } from '../Button/FullWidthButtonContainer';

interface ValuePickerProps<T> {
  /** Label to display on the picker button */
  label: string;
  /** Icon to display on the picker button */
  icon?: IconName;
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
        <FullWidthButtonContainer>
          <Button size="sm" icon={icon || 'plus-circle'} onClick={() => setIsPicking(true)} variant={variant}>
            {label}
          </Button>
        </FullWidthButtonContainer>
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
