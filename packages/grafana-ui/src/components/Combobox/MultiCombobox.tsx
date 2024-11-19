import { useCombobox, useMultipleSelection } from 'downshift';
import { useState } from 'react';

import { useStyles2 } from '../../themes';
import { Checkbox } from '../Forms/Checkbox';
import { Portal } from '../Portal/Portal';

import { ComboboxOption, ComboboxBaseProps, AutoSizeConditionals, itemToString } from './Combobox';
import { ValuePill } from './ValuePill';
import { getComboboxStyles } from './getComboboxStyles';
import { getMultiComboboxStyles } from './getMultiComboboxStyles';

//import { getComboboxStyles } from './getComboboxStyles';

interface MultiComboboxBaseProps<T extends string | number> extends Omit<ComboboxBaseProps<T>, 'value' | 'onChange'> {
  value?: string | Array<ComboboxOption<T>>;
  onChange: (items?: Array<ComboboxOption<T>>) => void;
}

type MultiComboboxProps<T extends string | number> = MultiComboboxBaseProps<T> & AutoSizeConditionals;

export const MultiCombobox = <T extends string | number>(props: MultiComboboxProps<T>) => {
  const { options, placeholder } = props;

  const styles = useStyles2(getComboboxStyles);
  const multiStyles = useStyles2(getMultiComboboxStyles);

  const isAsync = typeof options === 'function';

  const [items, _baseSetItems] = useState(isAsync ? [] : options);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Array<ComboboxOption<T>>>([]);

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
          }
          break;
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

    onStateChange: ({ inputValue: newInputValue, type, selectedItem: newSelectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          if (newSelectedItem) {
            const isAlreadySelected = selectedItems.some((opt) => opt.value === newSelectedItem.value);
            if (!isAlreadySelected) {
              setSelectedItems([...selectedItems, newSelectedItem]);
              break;
            }
            removeSelectedItem(newSelectedItem);
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
                return (
                  <Checkbox
                    //className={styles.optionBody}
                    key={`${item.value}${index}`}
                    style={highlightedIndex === index ? { backgroundColor: 'blue' } : {}}
                    {...itemProps}
                    checked={isSelected}
                    label={itemToString(item)}
                  />
                );
              })}
            </div>
          )}
        </Portal>
      </div>
    </div>
  );
};
