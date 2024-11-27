import { useCombobox, useMultipleSelection } from 'downshift';
import { useMemo, useState } from 'react';

import { useStyles2 } from '../../themes';
import { Checkbox } from '../Forms/Checkbox';
import { Portal } from '../Portal/Portal';

import { ComboboxOption, ComboboxBaseProps, AutoSizeConditionals, itemToString } from './Combobox';
import { OptionListItem } from './OptionListItem';
import { ValuePill } from './ValuePill';
import { getMultiComboboxStyles } from './getMultiComboboxStyles';

interface MultiComboboxBaseProps<T extends string | number> extends Omit<ComboboxBaseProps<T>, 'value' | 'onChange'> {
  value?: string[] | Array<ComboboxOption<T>>;
  onChange: (items?: T[]) => void;
}

type MultiComboboxProps<T extends string | number> = MultiComboboxBaseProps<T> & AutoSizeConditionals;

export const MultiCombobox = <T extends string | number>(props: MultiComboboxProps<T>) => {
  const { options, placeholder, onChange, value } = props;
  const isAsync = typeof options === 'function';

  const initialSelectedItems = useMemo(() => {
    if (!value || isAsync) {
      //TODO handle async
      return [];
    }

    if (!isComboboxOptions(value)) {
      const resultingItems: Array<ComboboxOption<T> | undefined> = [];

      for (const item of options) {
        value.forEach((val, index) => {
          if (val === item.value) {
            resultingItems[index] = item; // Use index to keep order
          }
        });
        if (resultingItems.length === value.length && !resultingItems.includes(undefined)) {
          // We found all items for the values
          break;
        }
      }
      return resultingItems.filter((item) => item !== undefined);
    }

    return value;
  }, [value, options, isAsync]);

  const multiStyles = useStyles2(getMultiComboboxStyles);

  const [items, _baseSetItems] = useState(isAsync ? [] : options);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Array<ComboboxOption<T>>>(initialSelectedItems);

  const [inputValue, setInputValue] = useState('');

  const { getSelectedItemProps, getDropdownProps, removeSelectedItem } = useMultipleSelection({
    selectedItems, //initally selected items,
    onStateChange: ({ type, selectedItems: newSelectedItems }) => {
      switch (type) {
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
        case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
          if (newSelectedItems) {
            setSelectedItems(newSelectedItems);
            onChange(getComboboxOptionsValues([...selectedItems, ...newSelectedItems]));
          }
          break;
        case useMultipleSelection.stateChangeTypes.FunctionAddSelectedItem:
          if (newSelectedItems) {
            setSelectedItems(newSelectedItems);
            onChange(getComboboxOptionsValues(newSelectedItems));
          }
        default:
          break;
      }
    },
  });

  const {
    //getToggleButtonProps,
    //getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    //selectedItem,
  } = useCombobox({
    isOpen,
    items,
    itemToString,
    inputValue,
    //defaultHighlightedIndex: 0,
    selectedItem: null,
    stateReducer: (state, actionAndChanges) => {
      const { changes, type } = actionAndChanges;
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          return {
            ...changes,
            isOpen: true,
          };
        default:
          return changes;
      }
    },

    onStateChange: ({ inputValue: newInputValue, type, selectedItem: newSelectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          if (newSelectedItem) {
            const isAlreadySelected = selectedItems.some((opt) => opt.value === newSelectedItem.value);
            if (!isAlreadySelected) {
              //setSelectedItems([...selectedItems, newSelectedItem]);
              onChange(getComboboxOptionsValues([...selectedItems, newSelectedItem]));
              break;
            }
            removeSelectedItem(newSelectedItem); // onChange is handled by multiselect here
          }
          break;
        case useCombobox.stateChangeTypes.InputBlur:
          setIsOpen(false);
          setInputValue('');
          break;
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(newInputValue ?? '');
          break;
        default:
          break;
      }
    },
  });

  return (
    <div className={multiStyles.wrapper}>
      <span className={multiStyles.pillWrapper}>
        {selectedItems.map((item, index) => (
          <ValuePill
            onRemove={() => {
              removeSelectedItem(item);
            }}
            key={`${item.value}${index}`}
            {...getSelectedItemProps({ selectedItem: item, index })}
          >
            {itemToString(item)}
          </ValuePill>
        ))}
      </span>
      <input
        className={multiStyles.input}
        {...getInputProps(getDropdownProps({ preventKeyAction: isOpen, placeholder, onFocus: () => setIsOpen(true) }))}
      />
      <div {...getMenuProps()}>
        <Portal>
          {isOpen && (
            <div>
              {items.map((item, index) => {
                const itemProps = getItemProps({ item, index });
                const isSelected = selectedItems.some((opt) => opt.value === item.value);
                const id = 'multicombobox-option-' + item.value.toString();
                return (
                  <li
                    key={item.value}
                    {...itemProps}
                    style={highlightedIndex === index ? { backgroundColor: 'blue' } : {}}
                  >
                    {' '}
                    {/* Add styling with virtualization */}
                    <Checkbox key={id} value={isSelected} aria-labelledby={id} />
                    <OptionListItem option={item} id={id} />
                  </li>
                );
              })}
            </div>
          )}
        </Portal>
      </div>
    </div>
  );
};

function isComboboxOptions<T extends string | number>(
  value: string[] | Array<ComboboxOption<T>>
): value is Array<ComboboxOption<T>> {
  return typeof value[0] === 'object';
}

function getComboboxOptionsValues<T extends string | number>(optionArray: Array<ComboboxOption<T>>) {
  return optionArray.map((option) => option.value);
}
