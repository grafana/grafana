import { cx } from '@emotion/css';
import { useVirtualizer, type Range } from '@tanstack/react-virtual';
import { useCombobox } from 'downshift';
import { useCallback, useId, useMemo } from 'react';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
import { Icon } from '../Icon/Icon';
import { AutoSizeInput } from '../Input/AutoSizeInput';
import { Input, Props as InputProps } from '../Input/Input';
import { Portal } from '../Portal/Portal';

import { ComboboxList } from './ComboboxList';
import { itemToString } from './filter';
import { getComboboxStyles, MENU_OPTION_HEIGHT, MENU_OPTION_HEIGHT_DESCRIPTION } from './getComboboxStyles';
import { ComboboxOption } from './types';
import { useComboboxFloat } from './useComboboxFloat';
import { useOptions } from './useOptions';
import { isNewGroup } from './utils';

// TODO: It would be great if ComboboxOption["label"] was more generic so that if consumers do pass it in (for async),
// then the onChange handler emits ComboboxOption with the label as non-undefined.

interface ComboboxStaticProps<T extends string | number>
  extends Pick<
    InputProps,
    'placeholder' | 'autoFocus' | 'id' | 'aria-labelledby' | 'disabled' | 'loading' | 'invalid'
  > {
  /**
   * Allows the user to set a value which is not in the list of options.
   */
  createCustomValue?: boolean;

  /**
   * An array of options, or a function that returns a promise resolving to an array of options.
   * If a function, it will be called when the menu is opened and on keypress with the current search query.
   */
  options: Array<ComboboxOption<T>> | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);

  /**
   * Current selected value. Most consumers should pass a scalar value (string | number). However, sometimes with Async
   * it may be better to pass in an Option with a label to display.
   */
  value?: T | ComboboxOption<T> | null;

  /**
   * Defaults to full width of container. Number is a multiple of the spacing unit. 'auto' will size the input to the content.
   * */
  width?: number | 'auto';

  ['data-testid']?: string;

  /**
   * Called when the input loses focus.
   */
  onBlur?: () => void;
}

interface ClearableProps<T extends string | number> {
  /**
   * An `X` appears in the UI, which clears the input and sets the value to `null`. Do not use if you have no `null` case.
   */
  isClearable: true;

  /**
   * onChange handler is called with the newly selected option.
   */
  onChange: (option: ComboboxOption<T> | null) => void;
}

interface NotClearableProps<T extends string | number> {
  /**
   * An `X` appears in the UI, which clears the input and sets the value to `null`. Do not use if you have no `null` case.
   */
  isClearable?: false;

  /**
   * onChange handler is called with the newly selected option.
   */
  onChange: (option: ComboboxOption<T>) => void;
}

export type ComboboxBaseProps<T extends string | number> = (ClearableProps<T> | NotClearableProps<T>) &
  ComboboxStaticProps<T>;

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

export type ComboboxProps<T extends string | number> = ComboboxBaseProps<T> & AutoSizeConditionals;

const noop = () => {};

export const VIRTUAL_OVERSCAN_ITEMS = 4;

/**
 * A performant Select replacement.
 *
 * @alpha
 */
export const Combobox = <T extends string | number>(props: ComboboxProps<T>) => {
  const {
    options: allOptions,
    onChange,
    value: valueProp,
    placeholder: placeholderProp,
    isClearable, // this should be default false, but TS can't infer the conditional type if you do
    createCustomValue = false,
    id,
    width,
    minWidth,
    maxWidth,
    'aria-labelledby': ariaLabelledBy,
    'data-testid': dataTestId,
    autoFocus,
    onBlur,
    disabled,
    loading,
    invalid,
  } = props;

  // Value can be an actual scalar Value (string or number), or an Option (value + label), so
  // get a consistent Value from it
  const value = typeof valueProp === 'object' ? valueProp?.value : valueProp;
  const baseId = useId().replace(/:/g, '--');

  const {
    options: filteredOptions,
    groupStartIndices,
    updateOptions,
    asyncLoading,
    asyncError,
  } = useOptions(props.options, createCustomValue);
  const isAsync = typeof allOptions === 'function';

  const selectedItemIndex = useMemo(() => {
    if (isAsync) {
      return null;
    }

    if (valueProp === undefined || valueProp === null) {
      return null;
    }

    const index = allOptions.findIndex((option) => option.value === value);
    if (index === -1) {
      return null;
    }

    return index;
  }, [valueProp, allOptions, value, isAsync]);

  const selectedItem = useMemo(() => {
    if (valueProp === undefined || valueProp === null) {
      return null;
    }

    if (selectedItemIndex !== null && !isAsync) {
      return allOptions[selectedItemIndex];
    }

    return typeof valueProp === 'object' ? valueProp : { value: valueProp, label: valueProp.toString() };
  }, [selectedItemIndex, isAsync, valueProp, allOptions]);

  const menuId = `${baseId}-downshift-menu`;
  const labelId = `${baseId}-downshift-label`;

  const styles = useStyles2(getComboboxStyles);

  // Injects the group header for the first rendered item into the range to render.
  // Accepts the range that useVirtualizer wants to render, and then returns indexes
  // to actually render.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const startIndex = Math.max(0, range.startIndex - range.overscan);
      const endIndex = Math.min(filteredOptions.length - 1, range.endIndex + range.overscan);
      const rangeToReturn = Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);

      // If the first item doesn't have a group, no need to find a header for it
      const firstDisplayedOption = filteredOptions[rangeToReturn[0]];
      if (firstDisplayedOption?.group) {
        const groupStartIndex = groupStartIndices.get(firstDisplayedOption.group);
        if (groupStartIndex !== undefined && groupStartIndex < rangeToReturn[0]) {
          rangeToReturn.unshift(groupStartIndex);
        }
      }

      return rangeToReturn;
    },
    [filteredOptions, groupStartIndices]
  );

  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index: number) => {
      const firstGroupItem = isNewGroup(filteredOptions[index], index > 0 ? filteredOptions[index - 1] : undefined);
      const hasDescription = 'description' in filteredOptions[index];
      const hasGroup = 'group' in filteredOptions[index];

      let itemHeight = MENU_OPTION_HEIGHT;
      if (hasDescription) {
        itemHeight = MENU_OPTION_HEIGHT_DESCRIPTION;
      }
      if (firstGroupItem && hasGroup) {
        itemHeight += MENU_OPTION_HEIGHT;
      }
      return itemHeight;
    },
    overscan: VIRTUAL_OVERSCAN_ITEMS,
    rangeExtractor,
  });

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
    items: filteredOptions,
    itemToString,
    selectedItem,

    // Don't change downshift state in the onBlahChange handlers. Instead, use the stateReducer to make changes.
    // Downshift calls change handlers on the render after so you can get sync/flickering issues if you change its state
    // in them.
    // Instead, stateReducer is called in the same tick as state changes, before that state is committed and rendered.

    onSelectedItemChange: ({ selectedItem }) => {
      // `selectedItem` type is `ComboboxOption<T> | null`
      // It can be null when `selectItem()` is called with null, and we never do that unless `isClearable` is true.
      // So, when `isClearable` is false, `selectedItem` is always non-null. However, the types don't reflect that,
      // which is why the conditions are needed.
      //
      // this is an else if because TS can't infer the correct onChange types from
      // (isClearable || selectedItem !== null)
      if (isClearable) {
        // onChange argument type allows null
        onChange(selectedItem);
      } else if (selectedItem !== null) {
        // onChange argument type *does not* allow null
        onChange(selectedItem);
      }
    },

    defaultHighlightedIndex: selectedItemIndex ?? 0,

    scrollIntoView: () => {},

    onIsOpenChange: ({ isOpen, inputValue }) => {
      if (isOpen && inputValue === '') {
        updateOptions(inputValue);
      }
    },

    onHighlightedIndexChange: ({ highlightedIndex, type }) => {
      if (type !== useCombobox.stateChangeTypes.MenuMouseLeave) {
        rowVirtualizer.scrollToIndex(highlightedIndex);
      }
    },
    onStateChange: ({ inputValue: newInputValue, type, selectedItem: newSelectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          updateOptions(newInputValue ?? '');

          break;
        default:
          break;
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

  const { inputRef, floatingRef, floatStyles, scrollRef } = useComboboxFloat(filteredOptions, isOpen);

  const isAutoSize = width === 'auto';
  const InputComponent = isAutoSize ? AutoSizeInput : Input;
  const placeholder = (isOpen ? itemToString(selectedItem) : null) || placeholderProp;

  const suffixIcon = asyncLoading
    ? 'spinner'
    : // If it's loading, show loading icon. Otherwise, icon indicating menu state
      isOpen
      ? 'search'
      : 'angle-down';

  const inputSuffix = (
    <>
      {value && value === selectedItem?.value && isClearable && (
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
  );

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
        suffix={inputSuffix}
        {...getInputProps({
          ref: inputRef,
          onChange: noop, // Empty onCall to avoid TS error https://github.com/downshift-js/downshift/issues/718
          'aria-labelledby': ariaLabelledBy, // Label should be handled with the Field component
          placeholder,
          'data-testid': dataTestId,
        })}
      />
      <Portal>
        <div
          className={cx(styles.menu, !isOpen && styles.menuClosed)}
          style={floatStyles}
          {...getMenuProps({
            ref: floatingRef,
            'aria-labelledby': ariaLabelledBy,
          })}
        >
          {isOpen && (
            <ComboboxList
              options={filteredOptions}
              highlightedIndex={highlightedIndex}
              selectedItems={selectedItem ? [selectedItem] : []}
              scrollRef={scrollRef}
              getItemProps={getItemProps}
              error={asyncError}
            />
          )}
        </div>
      </Portal>
    </div>
  );
};
