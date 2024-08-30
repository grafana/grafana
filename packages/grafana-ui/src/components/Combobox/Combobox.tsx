import { cx } from '@emotion/css';
import { autoUpdate, flip, size, useFloating } from '@floating-ui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCombobox } from 'downshift';
import { SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
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
  extends Omit<InputProps, 'prefix' | 'suffix' | 'value' | 'addonBefore' | 'addonAfter' | 'onChange'> {
  onChange: (val: Option | null) => void;
  value: Value | null;
  options: Option[];
}

function itemToString(item: Option | null) {
  return item?.label ?? '';
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
  return 45;
}

const MIN_HEIGHT = 400;
// On every 100th index we will recalculate the width of the popover.
const INDEX_WIDTH_CALCULATION = 100;
// A multiplier guesstimate times the amount of characters. If any padding or image support etc. is added this will need to be updated.
const WIDTH_MULTIPLIER = 7.3;

export const Combobox = ({ options, onChange, value, id, ...restProps }: ComboboxProps) => {
  const [items, setItems] = useState(options);
  const selectedItemIndex = useMemo(
    () => options.findIndex((option) => option.value === value) || null,
    [options, value]
  );
  const selectedItem = selectedItemIndex ? options[selectedItemIndex] : null;

  const inputRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  const styles = useStyles2(getComboboxStyles);
  const [popoverMaxWidth, setPopoverMaxWidth] = useState<number | undefined>(undefined);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined);

  const virtualizerOptions = {
    count: items.length,
    getScrollElement: () => floatingRef.current,
    estimateSize,
    overscan: 4,
  };

  const rowVirtualizer = useVirtualizer(virtualizerOptions);

  const {
    getInputProps,
    getMenuProps,
    getItemProps,
    isOpen,
    highlightedIndex,
    setInputValue,
    selectItem,
    openMenu,
    closeMenu,
  } = useCombobox({
    inputId: id,
    items,
    itemToString,
    selectedItem,
    defaultHighlightedIndex: selectedItemIndex ?? undefined,
    scrollIntoView: () => {},
    onInputValueChange: ({ inputValue }) => {
      setItems(options.filter(itemFilter(inputValue)));
    },
    onIsOpenChange: ({ isOpen }) => {
      // Default to displaying all values when opening
      if (isOpen) {
        setItems(options);
        return;
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      onChange(selectedItem);
    },
    onHighlightedIndexChange: ({ highlightedIndex, type }) => {
      if (type !== useCombobox.stateChangeTypes.MenuMouseLeave) {
        rowVirtualizer.scrollToIndex(highlightedIndex);
      }
    },
  });

  const onBlur = useCallback(() => {
    setInputValue(selectedItem?.label ?? '');
  }, [selectedItem, setInputValue]);

  // the order of middleware is important!
  const middleware = [
    flip({
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: true,
      boundary: document.body,
    }),
    size({
      apply({ availableWidth }) {
        setPopoverMaxWidth(availableWidth);
      },
    }),
  ];
  const elements = { reference: inputRef.current, floating: floatingRef.current };
  const { floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    middleware,
    elements,
    whileElementsMounted: autoUpdate,
  });

  const hasMinHeight = isOpen && rowVirtualizer.getTotalSize() >= MIN_HEIGHT;

  useDynamicWidth(items, rowVirtualizer.range, setPopoverWidth);

  return (
    <div>
      <Input
        suffix={
          <>
            {!!value && value === selectedItem?.value && (
              <Icon
                name="times"
                className={styles.clear}
                title={t('combobox.clear.title', 'Clear value')}
                tabIndex={0}
                role="button"
                onClick={() => {
                  selectItem(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    selectItem(null);
                  }
                }}
              />
            )}
            <Icon
              name={isOpen ? 'search' : 'angle-down'}
              onClick={() => {
                if (isOpen) {
                  closeMenu();
                } else {
                  openMenu();
                }
              }}
            />
          </>
        }
        {...restProps}
        {...getInputProps({
          ref: inputRef,
          /*  Empty onCall to avoid TS error
           *  See issue here: https://github.com/downshift-js/downshift/issues/718
           *  Downshift repo: https://github.com/downshift-js/downshift/tree/master
           */
          onChange: () => {},
          onBlur,
        })}
      />
      <div
        className={cx(styles.menu, hasMinHeight && styles.menuHeight)}
        style={{
          ...floatingStyles,
          maxWidth: popoverMaxWidth,
          minWidth: inputRef.current?.offsetWidth,
          width: popoverWidth,
        }}
        {...getMenuProps({ ref: floatingRef })}
      >
        {isOpen && (
          <ul style={{ height: rowVirtualizer.getTotalSize() }} className={styles.menuUlContainer}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              return (
                <li
                  key={items[virtualRow.index].value}
                  data-index={virtualRow.index}
                  className={cx(
                    styles.option,
                    selectedItem && items[virtualRow.index].value === selectedItem.value && styles.optionSelected,
                    highlightedIndex === virtualRow.index && styles.optionFocused
                  )}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  {...getItemProps({ item: items[virtualRow.index], index: virtualRow.index })}
                >
                  <div className={styles.optionBody}>
                    <span className={styles.optionLabel}>{items[virtualRow.index].label}</span>
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

const useDynamicWidth = (
  items: Option[],
  range: { startIndex: number; endIndex: number } | null,
  setPopoverWidth: { (value: SetStateAction<number | undefined>): void }
) => {
  useEffect(() => {
    if (range === null) {
      return;
    }
    const startVisibleIndex = range?.startIndex;
    const endVisibleIndex = range?.endIndex;

    if (typeof startVisibleIndex === 'undefined' || typeof endVisibleIndex === 'undefined') {
      return;
    }

    // Scroll down and default case
    if (
      startVisibleIndex === 0 ||
      (startVisibleIndex % INDEX_WIDTH_CALCULATION === 0 && startVisibleIndex >= INDEX_WIDTH_CALCULATION)
    ) {
      let maxLength = 0;
      const calculationEnd = Math.min(items.length, endVisibleIndex + INDEX_WIDTH_CALCULATION);

      for (let i = startVisibleIndex; i < calculationEnd; i++) {
        maxLength = Math.max(maxLength, items[i].label.length);
      }

      setPopoverWidth(maxLength * WIDTH_MULTIPLIER);
    } else if (endVisibleIndex % INDEX_WIDTH_CALCULATION === 0 && endVisibleIndex >= INDEX_WIDTH_CALCULATION) {
      // Scroll up case
      let maxLength = 0;
      const calculationStart = Math.max(0, startVisibleIndex - INDEX_WIDTH_CALCULATION);

      for (let i = calculationStart; i < endVisibleIndex; i++) {
        maxLength = Math.max(maxLength, items[i].label.length);
      }

      setPopoverWidth(maxLength * WIDTH_MULTIPLIER);
    }
  }, [items, range, setPopoverWidth]);
};
