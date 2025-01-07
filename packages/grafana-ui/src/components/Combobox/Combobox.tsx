import { cx } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCombobox } from 'downshift';
import { debounce } from 'lodash';
import { ReactNode, useCallback, useId, useMemo, useState } from 'react';

import { useStyles2 } from '../../themes';
import { logOptions } from '../../utils';
import { t, Trans } from '../../utils/i18n';
import { Icon } from '../Icon/Icon';
import { AutoSizeInput } from '../Input/AutoSizeInput';
import { Input, Props as InputProps } from '../Input/Input';
import { Box } from '../Layout/Box/Box';
import { Stack } from '../Layout/Stack/Stack';
import { Portal } from '../Portal/Portal';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

import { getComboboxStyles, MENU_OPTION_HEIGHT, MENU_OPTION_HEIGHT_DESCRIPTION } from './getComboboxStyles';
import { useComboboxFloat } from './useComboboxFloat';
import { StaleResultError, useLatestAsyncCall } from './useLatestAsyncCall';

export type ComboboxOption<T extends string | number = string> = {
  label?: string;
  value: T;
  description?: string;
};

// TODO: It would be great if ComboboxOption["label"] was more generic so that if consumers do pass it in (for async),
// then the onChange handler emits ComboboxOption with the label as non-undefined.
export interface ComboboxBaseProps<T extends string | number>
  extends Pick<
    InputProps,
    'placeholder' | 'autoFocus' | 'id' | 'aria-labelledby' | 'disabled' | 'loading' | 'invalid'
  > {
  /**
   * An `X` appears in the UI, which clears the input and sets the value to `null`. Do not use if you have no `null` case.
   */
  isClearable?: boolean;
  /**
   * Allows the user to set a value which is not in the list of options.
   */
  createCustomValue?: boolean;
  options: Array<ComboboxOption<T>> | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);
  onChange: (option: ComboboxOption<T>) => void;
  /**
   * Most consumers should pass value in as a scalar string | number. However, sometimes with Async because we don't
   * have the full options loaded to match the value to, consumers may also pass in an Option with a label to display.
   */
  value?: T | ComboboxOption<T> | null;
  /**
   * Defaults to 100%. Number is a multiple of 8px. 'auto' will size the input to the content.
   * */
  width?: number | 'auto';
  onBlur?: () => void;
}

const RECOMMENDED_ITEMS_AMOUNT = 100_000;

type ClearableConditionals<T extends number | string> =
  | {
      isClearable: true;
      /**
       * The onChange handler is called with `null` when clearing the Combobox.
       */
      onChange: (option: ComboboxOption<T> | null) => void;
    }
  | { isClearable?: false; onChange: (option: ComboboxOption<T>) => void };

export type AutoSizeConditionals =
  | {
      width: 'auto';
      /**
       * Needs to be set when width is 'auto' to prevent the input from shrinking too much
       */
      minWidth: number;
      /**
       * Recommended to set when width is 'auto' to prevent the input from growing too much.
       */
      maxWidth?: number;
    }
  | {
      width?: number;
      minWidth?: never;
      maxWidth?: never;
    };

type ComboboxProps<T extends string | number> = ComboboxBaseProps<T> & AutoSizeConditionals & ClearableConditionals<T>;

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (!item) {
    return '';
  }
  if (item.label?.includes('Custom value: ')) {
    return item.value.toString();
  }
  return item.label ?? item.value.toString();
}

function itemFilter<T extends string | number>(inputValue: string) {
  const lowerCasedInputValue = inputValue.toLowerCase();

  return (item: ComboboxOption<T>) => {
    return (
      !inputValue ||
      item.label?.toLowerCase().includes(lowerCasedInputValue) ||
      item.value?.toString().toLowerCase().includes(lowerCasedInputValue)
    );
  };
}

const noop = () => {};
const asyncNoop = () => Promise.resolve([]);

export const VIRTUAL_OVERSCAN_ITEMS = 4;

/**
 * A performant Select replacement.
 *
 * @alpha
 */
export const Combobox = <T extends string | number>(props: ComboboxProps<T>) => {
  const {
    options,
    onChange,
    value: valueProp,
    placeholder: placeholderProp,
    isClearable = false,
    createCustomValue = false,
    id,
    width,
    minWidth,
    maxWidth,
    'aria-labelledby': ariaLabelledBy,
    autoFocus,
    onBlur,
    disabled,
    loading,
    invalid,
  } = props;

  // Value can be an actual scalar Value (string or number), or an Option (value + label), so
  // get a consistent Value from it
  const value = typeof valueProp === 'object' ? valueProp?.value : valueProp;

  const isAsync = typeof options === 'function';
  const loadOptions = useLatestAsyncCall(isAsync ? options : asyncNoop); // loadOptions isn't called at all if not async
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState(false);

  // A custom setter to always prepend the custom value at the beginning, if needed
  const [items, baseSetItems] = useState(isAsync ? [] : options);
  const setItems = useCallback(
    (items: Array<ComboboxOption<T>>, inputValue: string | undefined) => {
      let itemsToSet = items;
      logOptions(itemsToSet.length, RECOMMENDED_ITEMS_AMOUNT, id, ariaLabelledBy);
      if (inputValue && createCustomValue) {
        const optionMatchingInput = items.find(
          (opt) => opt.label === 'Custom value: ' + inputValue || opt.value === inputValue
        );

        if (!optionMatchingInput) {
          const customValueOption = {
            label: t('combobox.custom-value.label', 'Custom value: ') + inputValue,
            // Type casting needed to make this work when T is a number
            value: inputValue as unknown as T,
            /* TODO: Add this back when we do support descriptions and have need for it
            description: t('combobox.custom-value.create', 'Create custom value'),
            */
          };

          itemsToSet = items.slice(0);
          itemsToSet.unshift(customValueOption);
        }
      }

      baseSetItems(itemsToSet);
    },
    [createCustomValue, id, ariaLabelledBy]
  );

  const selectedItemIndex = useMemo(() => {
    if (isAsync) {
      return null;
    }

    if (valueProp === undefined || valueProp === null) {
      return null;
    }

    const index = options.findIndex((option) => option.value === value);
    if (index === -1) {
      return null;
    }

    return index;
  }, [valueProp, options, value, isAsync]);

  const selectedItem = useMemo(() => {
    if (valueProp === undefined || valueProp === null) {
      return null;
    }

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
    getScrollElement: () => scrollRef.current,
    estimateSize: (index: number) => (items[index].description ? MENU_OPTION_HEIGHT_DESCRIPTION : MENU_OPTION_HEIGHT),
    overscan: VIRTUAL_OVERSCAN_ITEMS,
  };

  const rowVirtualizer = useVirtualizer(virtualizerOptions);

  const debounceAsync = useMemo(
    () =>
      debounce((inputValue: string) => {
        loadOptions(inputValue)
          .then((opts) => {
            setItems(opts, inputValue);
            setAsyncLoading(false);
            setAsyncError(false);
          })
          .catch((err) => {
            if (!(err instanceof StaleResultError)) {
              setAsyncError(true);
              setAsyncLoading(false);
            }
          });
      }, 200),
    [loadOptions, setItems]
  );

  const {
    isOpen,
    highlightedIndex,

    getInputProps,
    getMenuProps,
    getItemProps,

    selectItem,
  } = useCombobox({
    menuId,
    labelId,
    inputId: id,
    items,
    itemToString,
    selectedItem,

    // Don't change downshift state in the onBlahChange handlers. Instead, use the stateReducer to make changes.
    // Downshift calls change handlers on the render after so you can get sync/flickering issues if you change its state
    // in them.
    // Instead, stateReducer is called in the same tick as state changes, before that state is committed and rendered.

    onSelectedItemChange: ({ selectedItem }) => {
      onChange(selectedItem);
    },

    defaultHighlightedIndex: selectedItemIndex ?? 0,

    scrollIntoView: () => {},

    onInputValueChange: ({ inputValue, isOpen }) => {
      if (!isOpen) {
        // Prevent stale options from showing on reopen
        if (isAsync) {
          setItems([], '');
        }

        // Otherwise there's nothing else to do when the menu isnt open
        return;
      }

      if (!isAsync) {
        const filteredItems = options.filter(itemFilter(inputValue));
        setItems(filteredItems, inputValue);
      } else {
        if (inputValue && createCustomValue) {
          setItems([], inputValue);
        }

        setAsyncLoading(true);
        debounceAsync(inputValue);
      }
    },

    onIsOpenChange: ({ isOpen, inputValue }) => {
      // Loading async options mostly happens in onInputValueChange, but if the menu is opened with an empty input
      // then onInputValueChange isn't called (because the input value hasn't changed)
      if (isAsync && isOpen && inputValue === '') {
        setAsyncLoading(true);
        // TODO: dedupe this loading logic with debounceAsync
        loadOptions(inputValue)
          .then((opts) => {
            setItems(opts, inputValue);
            setAsyncLoading(false);
            setAsyncError(false);
          })
          .catch((err) => {
            if (!(err instanceof StaleResultError)) {
              setAsyncError(true);
              setAsyncLoading(false);
            }
          });
      }
    },

    onHighlightedIndexChange: ({ highlightedIndex, type }) => {
      if (type !== useCombobox.stateChangeTypes.MenuMouseLeave) {
        rowVirtualizer.scrollToIndex(highlightedIndex);
      }
    },

    stateReducer(state, actionAndChanges) {
      let { changes } = actionAndChanges;
      const menuBeingOpened = state.isOpen === false && changes.isOpen === true;
      const menuBeingClosed = state.isOpen === true && changes.isOpen === false;

      // Reset the input value when the menu is opened. If the menu is opened due to an input change
      // then make sure we keep that.
      // This will trigger onInputValueChange to load async options
      if (menuBeingOpened && changes.inputValue === state.inputValue) {
        changes = {
          ...changes,
          inputValue: '',
        };
      }

      if (menuBeingClosed) {
        // Flush the selected item to the input when the menu is closed
        if (changes.selectedItem) {
          changes = {
            ...changes,
            inputValue: itemToString(changes.selectedItem),
          };
        } else if (changes.inputValue !== '') {
          // Otherwise if no selected value, clear any search from the input
          changes = {
            ...changes,
            inputValue: '',
          };
        }
      }

      return changes;
    },
  });

  const { inputRef, floatingRef, floatStyles, scrollRef } = useComboboxFloat(items, isOpen);

  const isAutoSize = width === 'auto';

  const InputComponent = isAutoSize ? AutoSizeInput : Input;

  const suffixIcon = asyncLoading
    ? 'spinner'
    : // If it's loading, show loading icon. Otherwise, icon indicating menu state
      isOpen
      ? 'search'
      : 'angle-down';

  const placeholder = (isOpen ? itemToString(selectedItem) : null) || placeholderProp;

  return (
    <div className={isAutoSize ? styles.addaptToParent : undefined}>
      <InputComponent
        width={isAutoSize ? undefined : width}
        {...(isAutoSize ? { minWidth, maxWidth } : {})}
        autoFocus={autoFocus}
        onBlur={onBlur}
        disabled={disabled}
        loading={loading}
        invalid={invalid}
        className={styles.input}
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

            <Icon name={suffixIcon} />
          </>
        }
        {...getInputProps({
          ref: inputRef,
          /*  Empty onCall to avoid TS error
           *  See issue here: https://github.com/downshift-js/downshift/issues/718
           *  Downshift repo: https://github.com/downshift-js/downshift/tree/master
           */
          onChange: noop,
          'aria-labelledby': ariaLabelledBy, // Label should be handled with the Field component
          placeholder,
        })}
      />
      <Portal>
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
            <ScrollContainer showScrollIndicators maxHeight="inherit" ref={scrollRef}>
              {!asyncError && (
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
              <div aria-live="polite">
                {asyncError && (
                  <MessageRow>
                    <Icon name="exclamation-triangle" size="md" className={styles.warningIcon} />
                    <Trans i18nKey="combobox.async.error">An error occurred while loading options.</Trans>
                  </MessageRow>
                )}
                {items.length === 0 && !asyncError && (
                  <MessageRow>
                    <Trans i18nKey="combobox.options.no-found">No options found.</Trans>
                  </MessageRow>
                )}
              </div>
            </ScrollContainer>
          )}
        </div>
      </Portal>
    </div>
  );
};

const MessageRow = ({ children }: { children: ReactNode }) => {
  return (
    <Box padding={2} color="secondary">
      <Stack justifyContent="center" alignItems="center">
        {children}
      </Stack>
    </Box>
  );
};
