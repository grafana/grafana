import { cx } from '@emotion/css';
import { autoUpdate, flip, useFloating } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCombobox } from 'downshift';
import { useMemo, useRef, useState } from 'react';

import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Input, Props as InputProps } from '../Input/Input';

import { getComboboxStyles } from './getComboboxStyles';

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
  const floatingRef = useRef(null);

  const theme = useTheme2();
  const styles = getComboboxStyles(theme);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize,
    overscan: 2,
  });

  const { getInputProps, getMenuProps, getItemProps, isOpen, highlightedIndex } = useCombobox({
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

  // the order of middleware is important!
  const middleware = [
    flip({
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: false,
      boundary: document.body,
      fallbackPlacements: ['top'],
    }),
  ];

  const { refs } = useFloating({
    open: isOpen,
    placement: 'bottom',
    middleware,
    whileElementsMounted: autoUpdate,
  });
  refs.reference = listRef;
  refs.floating = floatingRef;

  const hasMinHeight = isOpen && rowVirtualizer.getTotalSize() >= 400;

  return (
    <div>
      <Input suffix={<Icon name={isOpen ? 'search' : 'angle-down'} />} {...restProps} {...getInputProps()} />
      <div className={cx(styles.menu, hasMinHeight && styles.menuHeight)} {...getMenuProps({ ref: listRef })}>
        {isOpen && (
          <ul className={styles.valueContainer} style={{ height: rowVirtualizer.getTotalSize() }} ref={floatingRef}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              return (
                <li
                  key={items[virtualRow.index].value}
                  {...getItemProps({ item: items[virtualRow.index], index: virtualRow.index })}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={cx(
                    styles.option,
                    selectedItem && items[virtualRow.index].value === selectedItem.value && styles.optionSelected,
                    highlightedIndex === virtualRow.index && styles.optionFocused
                  )}
                >
                  <div className={styles.optionBody}>
                    <span>{items[virtualRow.index].label}</span>
                    {items[virtualRow.index].description && (
                      <span className={styles.optionDescription}>{items[virtualRow.index].description}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
