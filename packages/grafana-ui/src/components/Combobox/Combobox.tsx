import { cx } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCombobox } from 'downshift';
import { useCallback, useId, useMemo, useState } from 'react';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
import { Icon } from '../Icon/Icon';
import { AutoSizeInput } from '../Input/AutoSizeInput';
import { Input, Props as InputProps } from '../Input/Input';

import { getComboboxStyles } from './getComboboxStyles';
import { estimateSize, useComboboxFloat } from './useComboboxFloat';
import { StaleResultError, useLatestAsyncCall } from './useLatestAsyncCall';

export type ComboboxOption<T extends string | number = string> = {
  label?: string;
  value: T;
  description?: string;
};

// TODO: It would be great if ComboboxOption["label"] was more generic so that if consumers do pass it in (for async),
// then the onChange handler emits ComboboxOption with the label as non-undefined.
interface ComboboxBaseProps<T extends string | number>
  extends Omit<InputProps, 'prefix' | 'suffix' | 'value' | 'addonBefore' | 'addonAfter' | 'onChange' | 'width'> {
  isClearable?: boolean;
  createCustomValue?: boolean;
  options: Array<ComboboxOption<T>> | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);
  onChange: (option: ComboboxOption<T> | null) => void;
  /**
   * Most consumers should pass value in as a scalar string | number. However, sometimes with Async because we don't
   * have the full options loaded to match the value to, consumers may also pass in an Option with a label to display.
   */
  value: T | ComboboxOption<T> | null;
  /**
   * Defaults to 100%. Number is a multiple of 8px. 'auto' will size the input to the content.
   * */
  width?: number | 'auto';
}

type AutoSizeConditionals =
  | {
      width: 'auto';
      minWidth: number;
      maxWidth?: number;
    }
  | {
      width?: number;
      minWidth?: never;
      maxWidth?: never;
    };

type ComboboxProps<T extends string | number> = ComboboxBaseProps<T> & AutoSizeConditionals;

function itemToString<T extends string | number>(item: ComboboxOption<T> | null) {
  return item?.label ?? item?.value.toString() ?? '';
}

function itemFilter<T extends string | number>(inputValue: string) {
  const lowerCasedInputValue = inputValue.toLowerCase();

  return (item: ComboboxOption<T>) => {
    return (
      !inputValue ||
      item?.label?.toLowerCase().includes(lowerCasedInputValue) ||
      item?.value?.toString().toLowerCase().includes(lowerCasedInputValue)
    );
  };
}

const asyncNoop = () => Promise.resolve([]);

/**
 * A performant Select replacement.
 *
 * @alpha
 */
export const Combobox = <T extends string | number>({
  options,
  onChange,
  value: valueProp,
  isClearable = false,
  createCustomValue = false,
  id,
  width,
  'aria-labelledby': ariaLabelledBy,
  ...restProps
}: ComboboxProps<T>) => {
  // Value can be an actual scalar Value (string or number), or an Option (value + label), so
  // get a consistent Value from it
  const value = typeof valueProp === 'object' ? valueProp?.value : valueProp;

  const isAsync = typeof options === 'function';
  const loadOptions = useLatestAsyncCall(isAsync ? options : asyncNoop); // loadOptions isn't called at all if not async
  const [asyncLoading, setAsyncLoading] = useState(false);

  const [items, setItems] = useState(isAsync ? [] : options);

  const selectedItemIndex = useMemo(() => {
    if (isAsync) {
      return null;
    }

    if (value === null) {
      return null;
    }

    const index = options.findIndex((option) => option.value === value);
    if (index === -1) {
      return null;
    }

    return index;
  }, [options, value, isAsync]);

  const selectedItem = useMemo(() => {
    if (selectedItemIndex !== null && !isAsync) {
      return options[selectedItemIndex];
    }

    return typeof valueProp === 'object' ? valueProp : { value: valueProp, label: valueProp.toString() };
  }, [selectedItemIndex, isAsync, valueProp, options]);

  const menuId = `downshift-${useId().replace(/:/g, '--')}-menu`;
  const labelId = `downshift-${useId().replace(/:/g, '--')}-label`;

  const styles = useStyles2(getComboboxStyles);

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
    openMenu,
    closeMenu,
    selectItem,
  } = useCombobox({
    menuId,
    labelId,
    inputId: id,
    items,
    itemToString,
    selectedItem,
    onSelectedItemChange: ({ selectedItem }) => {
      onChange(selectedItem);
    },
    defaultHighlightedIndex: selectedItemIndex ?? 0,
    scrollIntoView: () => {},
    onInputValueChange: ({ inputValue }) => {
      const customValueOption =
        createCustomValue &&
        inputValue &&
        items.findIndex((opt) => opt.label === inputValue || opt.value === inputValue) === -1
          ? {
              // Type casting needed to make this work when T is a number
              value: inputValue as unknown as T,
              description: t('combobox.custom-value.create', 'Create custom value'),
            }
          : null;

      if (isAsync) {
        if (customValueOption) {
          setItems([customValueOption]);
        }
        setAsyncLoading(true);
        loadOptions(inputValue)
          .then((opts) => {
            setItems(customValueOption ? [customValueOption, ...opts] : opts);
            setAsyncLoading(false);
          })
          .catch((err) => {
            if (!(err instanceof StaleResultError)) {
              // TODO: handle error
              setAsyncLoading(false);
            }
          });

        return;
      }

      const filteredItems = options.filter(itemFilter(inputValue));

      setItems(customValueOption ? [customValueOption, ...filteredItems] : filteredItems);
    },

    onIsOpenChange: ({ isOpen }) => {
      // Default to displaying all values when opening
      if (isOpen && !isAsync) {
        setItems(options);
        return;
      }

      if (isOpen && isAsync) {
        setAsyncLoading(true);
        loadOptions('').then((options) => {
          setItems(options);
          setAsyncLoading(false);
        });
        return;
      }
    },
    onHighlightedIndexChange: ({ highlightedIndex, type }) => {
      if (type !== useCombobox.stateChangeTypes.MenuMouseLeave) {
        rowVirtualizer.scrollToIndex(highlightedIndex);
      }
    },
  });

  const { inputRef, floatingRef, floatStyles } = useComboboxFloat(items, rowVirtualizer.range, isOpen);

  const onBlur = useCallback(() => {
    setInputValue(selectedItem?.label ?? value?.toString() ?? '');
  }, [selectedItem, setInputValue, value]);

  const InputComponent = width === 'auto' ? AutoSizeInput : Input;

  return (
    <div>
      <InputComponent
        width={width === 'auto' ? undefined : width}
        suffix={
          <>
            {!!value && value === selectedItem?.value && isClearable && (
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
        loading={asyncLoading}
        {...restProps}
        {...getInputProps({
          ref: inputRef,
          /*  Empty onCall to avoid TS error
           *  See issue here: https://github.com/downshift-js/downshift/issues/718
           *  Downshift repo: https://github.com/downshift-js/downshift/tree/master
           */
          onChange: () => {},
          onBlur,
          'aria-labelledby': ariaLabelledBy, // Label should be handled with the Field component
        })}
      />
      <div
        className={cx(styles.menu, !isOpen && styles.menuClosed)}
        style={{
          ...floatStyles,
        }}
        {...getMenuProps({
          ref: floatingRef,
          'aria-labelledby': ariaLabelledBy,
        })}
      >
        {isOpen && (
          <ul style={{ height: rowVirtualizer.getTotalSize() }} className={styles.menuUlContainer}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              return (
                <li
                  key={`${items[virtualRow.index].value}-${virtualRow.index}`}
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
                  {...getItemProps({
                    item: items[virtualRow.index],
                    index: virtualRow.index,
                  })}
                >
                  <div className={styles.optionBody}>
                    <span className={styles.optionLabel}>
                      {items[virtualRow.index].label ?? items[virtualRow.index].value}
                    </span>
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
