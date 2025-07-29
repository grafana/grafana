import { cx } from '@emotion/css';
import { useCombobox, useMultipleSelection } from 'downshift';
import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Portal } from '../Portal/Portal';
import { Text } from '../Text/Text';
import { Tooltip } from '../Tooltip/Tooltip';

import { ComboboxBaseProps, AutoSizeConditionals } from './Combobox';
import { ComboboxList } from './ComboboxList';
import { SuffixIcon } from './SuffixIcon';
import { ValuePill } from './ValuePill';
import { itemToString } from './filter';
import { getComboboxStyles } from './getComboboxStyles';
import { getMultiComboboxStyles } from './getMultiComboboxStyles';
import { ALL_OPTION_VALUE, ComboboxOption } from './types';
import { useComboboxFloat } from './useComboboxFloat';
import { MAX_SHOWN_ITEMS, useMeasureMulti } from './useMeasureMulti';
import { useMultiInputAutoSize } from './useMultiInputAutoSize';
import { useOptions } from './useOptions';

interface MultiComboboxBaseProps<T extends string | number>
  extends Omit<ComboboxBaseProps<T>, 'value' | 'onChange' | 'isClearable'> {
  value?: T[] | Array<ComboboxOption<T>>;
  onChange: (option: Array<ComboboxOption<T>>) => void;
  isClearable?: boolean;
  enableAllOption?: boolean;
  portalContainer?: HTMLElement;
}

export type MultiComboboxProps<T extends string | number> = MultiComboboxBaseProps<T> & AutoSizeConditionals;

export const MultiCombobox = <T extends string | number>(props: MultiComboboxProps<T>) => {
  const {
    placeholder,
    onChange,
    value,
    width,
    enableAllOption,
    invalid,
    disabled,
    minWidth,
    maxWidth,
    isClearable,
    createCustomValue = false,
    'aria-labelledby': ariaLabelledBy,
    'data-testid': dataTestId,
    portalContainer,
  } = props;

  const styles = useStyles2(getComboboxStyles);
  const [inputValue, setInputValue] = useState('');

  const allOptionItem = useMemo(() => {
    return {
      label:
        inputValue === ''
          ? t('multicombobox.all.title', 'All')
          : t('multicombobox.all.title-filtered', 'All (filtered)'),
      // Type casting needed to make this work when T is a number
      value: ALL_OPTION_VALUE,
    } as ComboboxOption<T>;
  }, [inputValue]);

  // Handle async options and the 'All' option
  const {
    options: baseOptions,
    updateOptions,
    asyncLoading,
    asyncError,
  } = useOptions(props.options, createCustomValue);
  const options = useMemo(() => {
    // Only add the 'All' option if there's more than 1 option
    const addAllOption = enableAllOption && baseOptions.length > 1;
    return addAllOption ? [allOptionItem, ...baseOptions] : baseOptions;
  }, [baseOptions, enableAllOption, allOptionItem]);
  const loading = props.loading || asyncLoading;

  const selectedItems = useMemo(() => {
    if (!value) {
      return [];
    }

    return getSelectedItemsFromValue<T>(value, typeof props.options !== 'function' ? props.options : baseOptions);
  }, [value, props.options, baseOptions]);

  const { measureRef, counterMeasureRef, suffixMeasureRef, shownItems } = useMeasureMulti(
    selectedItems,
    width,
    disabled
  );

  const isOptionSelected = useCallback(
    (item: ComboboxOption<T>) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  const { getSelectedItemProps, getDropdownProps, setSelectedItems, addSelectedItem, removeSelectedItem, reset } =
    useMultipleSelection({
      selectedItems, // initially selected items,
      onStateChange: ({ type, selectedItems: newSelectedItems }) => {
        switch (type) {
          case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownBackspace:
          case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
          case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
          case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
          case useMultipleSelection.stateChangeTypes.FunctionAddSelectedItem:
          case useMultipleSelection.stateChangeTypes.FunctionSetSelectedItems:
          case useMultipleSelection.stateChangeTypes.FunctionReset:
            // Unclear why newSelectedItems would be undefined, but this seems logical
            onChange(newSelectedItems ?? []);
            break;

          default:
            break;
        }
      },
      stateReducer: (_state, actionAndChanges) => {
        const { changes } = actionAndChanges;
        return {
          ...changes,

          /**
           * TODO: Fix Hack!
           * This prevents the menu from closing when the user unselects an item in the dropdown at the expense
           * of breaking keyboard navigation.
           *
           * Downshift isn't really designed to keep selected items in the dropdown menu, so when you unselect an item
           * in a multiselect, the stateReducer tries to move focus onto another item which causes the menu to be closed.
           * This only seems to happen when you deselect the last item in the selectedItems list.
           *
           * Check out:
           *  - FunctionRemoveSelectedItem in the useMultipleSelection reducer https://github.com/downshift-js/downshift/blob/master/src/hooks/useMultipleSelection/reducer.js#L75
           *  - The activeIndex useEffect in useMultipleSelection https://github.com/downshift-js/downshift/blob/master/src/hooks/useMultipleSelection/index.js#L68-L72
           *
           * Forcing the activeIndex to -999 both prevents the useEffect that changes the focus from triggering (value never changes)
           * and prevents the if statement in useMultipleSelection from focusing anything.
           */
          activeIndex: -999,
        };
      },
    });

  const {
    getToggleButtonProps,
    //getLabelProps,
    isOpen,
    highlightedIndex,
    getMenuProps,
    getInputProps,
    getItemProps,
  } = useCombobox({
    items: options,
    itemToString,
    inputValue,
    selectedItem: null,
    stateReducer: (state, actionAndChanges) => {
      const { type } = actionAndChanges;
      let { changes } = actionAndChanges;
      const menuBeingOpened = state.isOpen === false && changes.isOpen === true;

      // Reset the input value when the menu is opened. If the menu is opened due to an input change
      // then make sure we keep that.
      // This will trigger onInputValueChange to load async options
      if (menuBeingOpened && changes.inputValue === state.inputValue) {
        changes = {
          ...changes,
          inputValue: '',
        };
      }

      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          return {
            ...changes,
            isOpen: true,
            highlightedIndex: state.highlightedIndex,
          };
        case useCombobox.stateChangeTypes.InputBlur:
          setInputValue('');
        default:
          return changes;
      }
    },

    onIsOpenChange: ({ isOpen, inputValue }) => {
      if (isOpen && inputValue === '') {
        updateOptions(inputValue);
      }
    },

    onStateChange: ({ inputValue: newInputValue, type, selectedItem: newSelectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          // Handle All functionality
          if (newSelectedItem?.value === ALL_OPTION_VALUE) {
            // TODO: fix bug where if the search filtered items list is the
            // same length, but different, than the selected items (ask tobias)
            const isAllFilteredSelected = selectedItems.length === options.length - 1;

            // if every option is already selected, clear the selection.
            // otherwise, select all the options (excluding the first ALL_OTION)
            const realOptions = options.slice(1);
            let newSelectedItems = isAllFilteredSelected && inputValue === '' ? [] : realOptions;

            if (!isAllFilteredSelected && inputValue !== '') {
              // Select all currently filtered items and deduplicate
              newSelectedItems = [...new Set([...selectedItems, ...realOptions])];
            }

            if (isAllFilteredSelected && inputValue !== '') {
              // Deselect all currently filtered items
              const filteredSet = new Set(realOptions.map((item) => item.value));
              newSelectedItems = selectedItems.filter((item) => !filteredSet.has(item.value));
            }
            setSelectedItems(newSelectedItems);
          } else if (newSelectedItem && isOptionSelected(newSelectedItem)) {
            // Find the actual selected item object that matches the clicked item by value
            // This is necessary because the clicked item (from async options) may be a different
            // object reference than the selected item, and useMultipleSelection uses object equality
            const itemToRemove = selectedItems.find((item) => item.value === newSelectedItem.value);
            if (itemToRemove) {
              removeSelectedItem(itemToRemove);
            }
          } else if (newSelectedItem) {
            addSelectedItem(newSelectedItem);
          }
          break;
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(newInputValue ?? '');
          updateOptions(newInputValue ?? '');

          break;
        default:
          break;
      }
    },
  });

  const { inputRef: containerRef, floatingRef, floatStyles, scrollRef } = useComboboxFloat(options, isOpen);
  const multiStyles = useStyles2(
    getMultiComboboxStyles,
    isOpen,
    invalid,
    disabled,
    width,
    minWidth,
    maxWidth,
    isClearable
  );

  // Selected items that show up in the input field
  const visibleItems = isOpen ? selectedItems.slice(0, MAX_SHOWN_ITEMS) : selectedItems.slice(0, shownItems);

  const { inputRef, inputWidth } = useMultiInputAutoSize(inputValue);
  return (
    <div className={multiStyles.container} ref={containerRef}>
      <div className={cx(multiStyles.wrapper, { [multiStyles.disabled]: disabled })} ref={measureRef}>
        <span className={multiStyles.pillWrapper}>
          {visibleItems.map((item, index) => (
            <ValuePill
              disabled={disabled}
              onRemove={() => {
                removeSelectedItem(item);
              }}
              key={`${item.value}${index}`}
              {...getSelectedItemProps({ selectedItem: item, index })}
            >
              {itemToString(item)}
            </ValuePill>
          ))}
          {selectedItems.length > visibleItems.length && (
            <Box display="flex" direction="row" marginLeft={0.5} gap={1} ref={counterMeasureRef}>
              <Text>...</Text>
              <Tooltip
                interactive
                content={
                  <>
                    {selectedItems.slice(visibleItems.length).map((item) => (
                      <div key={item.value}>{itemToString(item)}</div>
                    ))}
                  </>
                }
              >
                <div className={multiStyles.restNumber}>{selectedItems.length - shownItems}</div>
              </Tooltip>
            </Box>
          )}
          <input
            className={multiStyles.input}
            {...getInputProps({
              ...getDropdownProps({
                disabled,
                preventKeyAction: isOpen,
                placeholder: visibleItems.length === 0 ? placeholder : '',
                ref: inputRef,
                style: { width: inputWidth },
              }),
              'aria-labelledby': ariaLabelledBy, // Label should be handled with the Field component
              'data-testid': dataTestId,
            })}
          />

          <div className={multiStyles.suffix} ref={suffixMeasureRef} {...getToggleButtonProps()}>
            {isClearable && selectedItems.length > 0 && (
              <Icon
                name="times"
                className={styles.clear}
                title={t('multicombobox.clear.title', 'Clear all')}
                tabIndex={0}
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    reset();
                  }
                }}
              />
            )}
            <SuffixIcon isLoading={loading || false} isOpen={isOpen} />
          </div>
        </span>
      </div>
      <Portal root={portalContainer}>
        <div
          className={cx(styles.menu, !isOpen && styles.menuClosed)}
          style={{
            ...floatStyles,
            width: floatStyles.width + 24, // account for checkbox
            pointerEvents: 'auto', // Override container's pointer-events: none
          }}
          {...getMenuProps({ ref: floatingRef })}
        >
          {isOpen && (
            <ComboboxList
              options={options}
              highlightedIndex={highlightedIndex}
              selectedItems={selectedItems}
              scrollRef={scrollRef}
              getItemProps={getItemProps}
              enableAllOption={enableAllOption}
              isMultiSelect={true}
              error={asyncError}
            />
          )}
        </div>
      </Portal>
    </div>
  );
};

function getSelectedItemsFromValue<T extends string | number>(
  value: T[] | Array<ComboboxOption<T>>,
  options: Array<ComboboxOption<T>>
) {
  if (isComboboxOptions(value)) {
    return value;
  }
  const valueMap = new Map(value.map((val, index) => [val, index]));
  const resultingItems: Array<ComboboxOption<T>> = [];

  for (const option of options) {
    const index = valueMap.get(option.value);
    if (index !== undefined) {
      resultingItems[index] = option;
      valueMap.delete(option.value);
    }
    if (valueMap.size === 0) {
      // We found all values
      break;
    }
  }

  // Handle items that are not in options
  for (const [val, index] of valueMap) {
    resultingItems[index] = { value: val };
  }
  return resultingItems;
}

function isComboboxOptions<T extends string | number>(
  value: T[] | Array<ComboboxOption<T>>
): value is Array<ComboboxOption<T>> {
  return typeof value[0] === 'object';
}
