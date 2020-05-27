import React, { useState } from 'react';
import { IconName } from '../../types';
import { SelectableValue } from '@grafana/data';
import { Button, ButtonVariant } from '../Button';
import { Select } from '../Select/Select';
import { FullWidthButtonContainer } from '../Button/FullWidthButtonContainer';
import { ComponentSize } from '../../types/size';

interface ValuePickerProps<T> {
  /** Label to display on the picker button */
  label: string;
  /** Icon to display on the picker button */
  icon?: IconName;
  /** ValuePicker options  */
  options: Array<SelectableValue<T>>;
  onChange: (value: SelectableValue<T>) => void;
  variant?: ButtonVariant;
  size?: ComponentSize;
  isFullWidth?: boolean;
  menuPlacement?: 'auto' | 'bottom' | 'top';
}

export function ValuePicker<T>({
  label,
  icon,
  options,
  onChange,
  variant,
  size = 'sm',
  isFullWidth = true,
  menuPlacement,
}: ValuePickerProps<T>) {
  const [isPicking, setIsPicking] = useState(false);

  const buttonEl = (
    <Button size={size || 'sm'} icon={icon || 'plus'} onClick={() => setIsPicking(true)} variant={variant}>
      {label}
    </Button>
  );
  return (
    <>
      {!isPicking && (isFullWidth ? <FullWidthButtonContainer>{buttonEl}</FullWidthButtonContainer> : buttonEl)}

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
          menuPlacement={menuPlacement}
        />
      )}
    </>
  );
}
