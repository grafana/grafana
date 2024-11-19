import { useCombobox, useMultipleSelection } from 'downshift';
import { useState } from 'react';

import { IconButton } from '../IconButton/IconButton';

import { ComboboxOption, ComboboxBaseProps, AutoSizeConditionals, itemToString } from './Combobox';

//import { useStyles2 } from '../../themes';
//import { getComboboxStyles } from './getComboboxStyles';

interface MultiComboboxBaseProps<T extends string | number> extends Omit<ComboboxBaseProps<T>, 'value' | 'onChange'> {
  value?: string | Array<ComboboxOption<T>>;
  onChange: (items?: Array<ComboboxOption<T>>) => void;
}

type MultiComboboxProps<T extends string | number> = MultiComboboxBaseProps<T> & AutoSizeConditionals;

export const MultiCombobox = <T extends string | number>(props: MultiComboboxProps<T>) => {
  const { options } = props;

  //const styles = useStyles2(getComboboxStyles);

  const isAsync = typeof options === 'function';

  const [items, _baseSetItems] = useState(isAsync ? [] : options);
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
    isOpen,
    //getToggleButtonProps,
    //getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    //selectedItem,
  } = useCombobox({
    items,
    itemToString,
    inputValue,
    //defaultHighlightedIndex: 0,
    selectedItem: null,
    onStateChange: ({ inputValue: newInputValue, type, selectedItem: newSelectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.InputBlur:
        case useCombobox.stateChangeTypes.ItemClick:
          if (newSelectedItem) {
            setSelectedItems([...selectedItems, newSelectedItem]);
            setInputValue('');
          }
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
    <div>
      <span>
        {selectedItems.map((item, index) => (
          <span key={`${item.value}${index}`} {...getSelectedItemProps({ selectedItem: item, index })}>
            {itemToString(item)}
            <IconButton
              name="times"
              onClick={(e) => {
                e.stopPropagation();
                removeSelectedItem(item);
              }}
              aria-label={`Remove ${itemToString(item)}`}
            />
          </span>
        ))}
      </span>
      <input {...getInputProps(getDropdownProps({ preventKeyAction: isOpen }))} />
      <div {...getMenuProps()}>
        {isOpen && (
          <div>
            {items.map((item, index) => (
              <div
                key={`${item.value}${index}`}
                {...getItemProps({ item, index })}
                style={highlightedIndex === index ? { backgroundColor: 'blue' } : {}}
              >
                {itemToString(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
