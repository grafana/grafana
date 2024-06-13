import { useCombobox } from 'downshift';
import React, { useMemo, useState } from 'react';

import { Icon } from '../Icon/Icon';
import { Input, Props as InputProps } from '../Input/Input';

type Value = string | number;
type Option = {
  label: string;
  value: Value;
};

interface ComboboxProps
  extends Omit<InputProps, 'width' | 'prefix' | 'suffix' | 'value' | 'addonBefore' | 'addonAfter' | 'onChange'> {
  onChange: (val: Option) => void;
  value: Value;
  options: Option[];
}

function itemToString(item: Option | null) {
  return item?.label || '';
}

function itemFilter(inputValue: string) {
  const lowerCasedInputValue = inputValue.toLowerCase();

  return (item: Option) => {
    return (
      !inputValue ||
      item?.label?.toLowerCase().includes(lowerCasedInputValue) ||
      item?.value?.toString().toLowerCase().includes(lowerCasedInputValue)
    );
  };
}

export const Combobox = ({ options, onChange, value, ...restProps }: ComboboxProps) => {
  const [items, setItems] = useState(options);
  const selectedItem = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);

  const { getInputProps, getMenuProps, getItemProps, isOpen } = useCombobox({
    items,
    itemToString,
    selectedItem,
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
