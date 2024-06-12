import { useCombobox } from 'downshift';
import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';

import { Input } from '../Input/Input';

interface SimpleSelectProps {
  onChange: (val: SelectableValue) => void;
  value: SelectableValue;
  options: SelectableValue[];
  placeholder: string;
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

export const SimpleSelect = ({ options, onChange, value, placeholder }: SimpleSelectProps) => {
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
      <Input placeholder={placeholder} {...getInputProps()} />
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
