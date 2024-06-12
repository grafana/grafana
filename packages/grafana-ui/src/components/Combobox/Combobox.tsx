import { useCombobox } from 'downshift';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';

import { Icon } from '../Icon/Icon';
import { Input, Props as InputProps } from '../Input/Input';

interface ComboboxProps
  extends Omit<InputProps, 'width' | 'prefix' | 'suffix' | 'value' | 'addonBefore' | 'addonAfter'> {
  onChange: (val: SelectableValue) => void;
  value: SelectableValue;
  options: SelectableValue[];
}

function itemToString(item: SelectableValue | null) {
  return item?.label || '';
}

function itemFilter(inputValue: string) {
  const lowerCasedInputValue = inputValue.toLowerCase();

  return (item: SelectableValue) => {
    return (
      !inputValue ||
      item?.label?.toLowerCase().includes(lowerCasedInputValue) ||
      item?.value?.toLowerCase().includes(lowerCasedInputValue)
    );
  };
}

export const Combobox = ({ options, onChange, value, ...restProps }: ComboboxProps) => {
  const [items, setItems] = useState(options);

  const { getInputProps, getMenuProps, getItemProps, isOpen } = useCombobox({
    items,
    itemToString,
    selectedItem: value,
    onInputValueChange: ({ inputValue }) => {
      setItems(options.filter(itemFilter(inputValue)));
    },
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem),
  });
  return (
    <div>
      <Input suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />} {...restProps} {...getInputProps()} />
      <ul {...getMenuProps()}>
        {isOpen &&
          items.map((item, index) => {
            return (
              <li key={item.value} {...getItemProps({ item, index })}>
                {item.label}
              </li>
            );
          })}
      </ul>
    </div>
  );
};
