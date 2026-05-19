import { cx } from '@emotion/css';
import { useCombobox, useMultipleSelection } from 'downshift';
import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { useFieldContext } from '../Forms/FieldContext';
import { Icon } from '../Icon/Icon';
import { Box } from '../Layout/Box/Box';
import { Portal } from '../Portal/Portal';
import { Text } from '../Text/Text';
import { Tooltip } from '../Tooltip/Tooltip';

import { type ComboboxBaseProps, type AutoSizeConditionals } from './Combobox';
import { ComboboxList } from './ComboboxList';
import { SuffixIcon } from './SuffixIcon';
import { ValuePill } from './ValuePill';
import { itemToString } from './filter';
import { getComboboxStyles } from './getComboboxStyles';
import { getMultiComboboxStyles } from './getMultiComboboxStyles';
import { ALL_OPTION_VALUE, type ComboboxOption } from './types';
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
}

export type MultiComboboxProps<T extends string | number> = MultiComboboxBaseProps<T> & AutoSizeConditionals;

/**
 * The behavior of the MultiCombobox is similar to that of the Combobox, but it allows you to select multiple options. For all non-multi behaviors, see the Combobox documentation.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-multicombobox--docs
 */
export const MultiCombobox = <T extends string | number>(props: MultiComboboxProps<T>) => {
  const {
    placeholder,
    onChange,
    value,
    width,
    enableAllOption,
    invalid: invalidProp,
    disabled: disabledProp,
    loading: loadingProp,
    minWidth,
    maxWidth,
    isClearable,
    createCustomValue = false,
    customValueDescription,
    'aria-labelledby': ariaLabelledBy,
    'data-testid': dataTestId,
    prefixIcon,
    id: idProp,
    options: optionsProp,
  } = props;

  const styles = useStyles2(getComboboxStyles);
  const [inputValue, setInputValue] = useState('');

  const fieldContext = useFieldContext();
  const id = idProp ?? fieldContext.id;
  const disabled = disabledProp ?? fieldContext.disabled;
  const invalid = invalidProp ?? fieldContext.invalid;
  const ariaDescribedBy = fieldContext['aria-describedby'];

  // Handle async options and the 'All' option
  const {
    options: baseOptions,
    updateOptions,
    asyncLoading,
    asyncError,
  } = useOptions(optionsProp, createCustomValue, customValueDescription);
  const loading = loadingProp || fieldContext.loading || asyncLoading;

  const selectedItems = useMemo(() => {
    if (!value) {
      return [];
    }

    return getSelectedItemsFromValue<T>(value, typeof optionsProp !== 'function' ? optionsProp : baseOptions);
  }, [value, optionsProp, baseOptions]);

  const allOptionItem = useMemo(() => {
    const isFiltered = inputValue !== '';
    const realBaseOptions = baseOptions.filter((opt) => !opt.infoOption);

    let label: string;
    if (isFiltered) {
      const anyFilteredSelected = realBaseOptions.some((opt) => selectedItems.some((s) => s.value === opt.value));
      label = anyFilteredSelected
        ? t('multicombobox.all.title-deselect-filtered', 'Deselect all (filtered)')
        : t('multicombobox.all.title-select-filtered', 'Select all (filtered)');
    } else {
      label =
        selectedItems.length > 0
          ? t('multicombobox.all.title-deselect', 'Deselect all')
          : t('multicombobox.all.title-select', 'Select all');
    }

    // Type casting needed to make this work when T is a number
    return { label, value: ALL_OPTION_VALUE } as ComboboxOption<T>;
  }, [inputValue, selectedItems, baseOptions]);

  const options = useMemo(() => {
    // Only add the 'All' option if there's more than 1 option
    const addAllOption = enableAllOption && baseOptions.length > 1;
    return addAllOption ? [allOptionItem, ...baseOptions] : baseOptions;
  }, [baseOptions, enableAllOption, allOptionItem]);

  const { measureRef, counterMeasureRef, suffixMeasureRef, shownItems } = useMeasureMulti(
    selectedItems,
    width,
    disabled
  );

  const isOptionSelected = useCallback(
    (item: ComboboxOption<T>) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // Synchronously update inputValue so it is batched with downshift's dispatch
    // in a single React render. See onStateChange InputChange case for details.
    setInputValue(event.target.value);
  }, []);

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

  const { isOpen, highlightedIndex, getMenuProps, getInputProps, getItemProps } = useCombobox({
    items: options,
    itemToString,
    inputId: id,
    inputValue,
    selectedItem: null,
    isItemDisabled: (item) => !!item?.infoOption,
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
          // Don't allow selection of info options
          if (newSelectedItem?.infoOption) {
            break;
          }

          // Handle All functionality
          if (newSelectedItem?.value === ALL_OPTION_VALUE) {
            const isFiltered = inputValue !== '';
            const realOptions = options.slice(1).filter((option) => !option.infoOption);

            if (isFiltered) {
              const filteredSet = new Set(realOptions.map((item) => item.value));
              const anyFilteredSelected = selectedItems.some((item) => filteredSet.has(item.value));
              if (anyFilteredSelected) {
                setSelectedItems(selectedItems.filter((item) => !filteredSet.has(item.value)));
              } else {
                setSelectedItems([...new Set([...selectedItems, ...realOptions])]);
              }
            } else {
              setSelectedItems(selectedItems.length > 0 ? [] : realOptions);
            }
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
          // setInputValue is intentionally NOT called here. It is called synchronously in the
          // input's onChange handler instead, so that it is batched with downshift's dispatch
          // in a single React render.
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
        {prefixIcon && (
          <Box marginLeft={0.5}>
            <Text color="secondary">
              <Icon name={prefixIcon} />
            </Text>
          </Box>
        )}
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
                <div className={multiStyles.restNumber}>{selectedItems.length - visibleItems.length}</div>
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
              'aria-describedby': ariaDescribedBy, // Description should be handled with the Field component
              'aria-labelledby': ariaLabelledBy, // Label should be handled with the Field component
              'data-testid': dataTestId,
              onChange: handleInputChange,
              onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                // Stop Escape from propagating to parent overlays (e.g. Modals, Drawers)
                // so that only the dropdown menu closes, not the parent.
                if (event.key === 'Escape' && isOpen) {
                  event.stopPropagation();
                }
              },
            })}
          />

          <div className={multiStyles.suffix} ref={suffixMeasureRef}>
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
      <Portal>
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
              loading={loading}
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
  // Deduplicate values before building the map. Without dedup, duplicate keys
  // cause Map to keep the last index, leaving earlier indices as undefined holes
  // in resultingItems (sparse array), which crashes when label is accessed.
  const valueMap = new Map<T, number>();
  let index = 0;
  for (const val of value) {
    if (!valueMap.has(val)) {
      valueMap.set(val, index);
      index++;
    }
  }
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
