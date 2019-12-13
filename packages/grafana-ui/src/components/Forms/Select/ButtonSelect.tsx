import React from 'react';

import { Button, ButtonVariant } from '../Button';
import { ButtonSize } from '../../Button/types';
import { SelectCommonProps, SelectBase } from './Select';
import { DropdownIndicator } from './DropdownIndicator';

interface ButtonSelectProps<T> extends Omit<SelectCommonProps<T>, 'renderControl' | 'size' | 'prefix'> {
  icon?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonSelect<T>({
  placeholder,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...selectProps
}: ButtonSelectProps<T>) {
  const buttonProps = {
    icon,
    variant,
    size,
    className,
    disabled,
  };

  return (
    <SelectBase
      {...selectProps}
      renderControl={({ onBlur, onClick, value, isOpen }) => {
        return (
          <Button {...buttonProps} onBlur={onBlur} onClick={onClick}>
            <>
              {value ? value.label : placeholder}
              <DropdownIndicator isOpen={isOpen} />
            </>
          </Button>
        );
      }}
    />
  );
}
