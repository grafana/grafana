import React, { useState } from 'react';
import { IconName } from '../../types';
import { SelectableValue } from '@grafana/data';
import { Button, ButtonVariant } from '../Button';
import { Select } from '../Select/Select';
import { FullWidthButtonContainer } from '../Button/FullWidthButtonContainer';
import { ComponentSize } from '../../types/size';
import { selectors } from '@grafana/e2e-selectors';

export interface ValuePickerProps<T> {
  /** Label to display on the picker button */
  label: string;
  /** Icon to display on the picker button */
  icon?: IconName;
  /** ValuePicker options  */
  options: Array<SelectableValue<T>>;
  /** Callback to handle selected option */
  onChange: (value: SelectableValue<T>) => void;
  /** Which ButtonVariant to render */
  variant?: ButtonVariant;
  /** Size of button  */
  size?: ComponentSize;
  /** Should the picker cover the full width of its parent */
  isFullWidth?: boolean;
  /** Control where the menu is rendered */
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
    <Button
      size={size || 'sm'}
      icon={icon || 'plus'}
      onClick={() => setIsPicking(true)}
      variant={variant}
      aria-label={selectors.components.ValuePicker.button(label)}
    >
      {label}
    </Button>
  );
  return (
    <>
      {!isPicking && (isFullWidth ? <FullWidthButtonContainer>{buttonEl}</FullWidthButtonContainer> : buttonEl)}

      {isPicking && (
        <span>
          <Select
            placeholder={label}
            options={options}
            aria-label={selectors.components.ValuePicker.select(label)}
            isOpen
            onCloseMenu={() => setIsPicking(false)}
            autoFocus={true}
            onChange={(value) => {
              setIsPicking(false);
              onChange(value);
            }}
            menuPlacement={menuPlacement}
          />
        </span>
      )}
    </>
  );
}
