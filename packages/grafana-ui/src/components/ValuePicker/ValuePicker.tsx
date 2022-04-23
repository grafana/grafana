import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { ComponentSize } from '../../types/size';
import { Button, ButtonVariant } from '../Button';
import { Select } from '../Select/Select';

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
  /** Min width for select in grid units */
  minWidth?: number;
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
  minWidth = 16,
  size = 'sm',
  isFullWidth = true,
  menuPlacement,
}: ValuePickerProps<T>) {
  const [isPicking, setIsPicking] = useState(false);
  const theme = useTheme2();

  return (
    <>
      {!isPicking && (
        <Button
          size={size || 'sm'}
          icon={icon || 'plus'}
          onClick={() => setIsPicking(true)}
          variant={variant}
          fullWidth={isFullWidth}
          aria-label={selectors.components.ValuePicker.button(label)}
        >
          {label}
        </Button>
      )}

      {isPicking && (
        <span style={{ minWidth: theme.spacing(minWidth), flexGrow: isFullWidth ? 1 : undefined }}>
          <Select
            menuShouldPortal
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
