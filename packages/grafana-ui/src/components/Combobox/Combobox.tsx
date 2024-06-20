import { css } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCombobox } from 'downshift';
import React, { useMemo, useRef, useState } from 'react';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Input, Props as InputProps } from '../Input/Input';

export type Value = string | number;
export type Option = {
  label: string;
  value: Value;
  description?: string;
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

  const styles = useStyles2(getStyles);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
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
      <div className={styles.dropwdown} {...getMenuProps({ ref: listRef })}>
        {isOpen && (
          <ul style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              return (
                <li
                  key={items[virtualRow.index].value}
                  {...getItemProps({ item: items[virtualRow.index], index: virtualRow.index })}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={styles.menuItem}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span>{items[virtualRow.index].label}</span>
                  {items[virtualRow.index].description && <span>{items[virtualRow.index].description}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

const getStyles = () => ({
  dropdown: css({
    position: 'absolute',
    height: 400,
    width: 600,
    overflowY: 'scroll',
    contain: 'strict',
  }),
  menuItem: css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    '&:first-child': {
      fontWeight: 'bold',
    },
  }),
});
