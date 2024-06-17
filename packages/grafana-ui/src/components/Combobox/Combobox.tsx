import { useCombobox } from 'downshift';
import React, { useMemo, useRef, useState } from 'react';
import { useVirtual } from 'react-virtual';

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

function estimateSize() {
  return 60;
}

export const Combobox = ({ options, onChange, value, ...restProps }: ComboboxProps) => {
  const [items, setItems] = useState(options);
  const selectedItem = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);
  const listRef = useRef(null);

  const rowVirtualizer = useVirtual({
    size: items.length,
    parentRef: listRef,
    estimateSize,
    overscan: 2,
  });

  const { getInputProps, getMenuProps, getItemProps, isOpen } = useCombobox({
    items,
    itemToString,
    selectedItem,
    scrollIntoView: () => {},
    onInputValueChange: ({ inputValue }) => {
      setItems(options.filter(itemFilter(inputValue)));
    },
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem),
    onHighlightedIndexChange: ({ highlightedIndex, type }) => {
      if (type !== useCombobox.stateChangeTypes.MenuMouseLeave) {
        rowVirtualizer.scrollToIndex(highlightedIndex);
      }
    },
  });
  return (
    <div>
      <Input suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />} {...restProps} {...getInputProps()} />
      <ul {...getMenuProps({ ref: listRef })}>
        {isOpen && (
          <>
            <li key="total-size" style={{ height: rowVirtualizer.totalSize }} />
            {rowVirtualizer.virtualItems.map((virtualRow) => {
              return (
                <li
                  key={items[virtualRow.index].value}
                  {...getItemProps({ item: items[virtualRow.index], index: virtualRow.index })}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {items[virtualRow.index].label}
                </li>
              );
            })}
          </>
        )}
      </ul>
    </div>
  );
};
