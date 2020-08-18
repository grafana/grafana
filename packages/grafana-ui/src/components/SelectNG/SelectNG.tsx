import React from 'react';
import Downshift from 'downshift';

import { SelectNGProps } from './types';
import {
  itemToString,
  renderDropdownButton,
  DEFAULT_NO_OPTIONS_MESSAGE,
  renderClearButton,
  renderDefaultTrigger,
  DEFAULT_PLACEHOLDER,
} from './utils';
import { SelectMenu, SelectMenuMessage } from './SelectMenu';
import { useSelect } from './hooks';

export function SelectNG<T>({
  value,
  onChange,
  options,
  placement = 'auto-start',
  noOptionsMessage = DEFAULT_NO_OPTIONS_MESSAGE,
  disabled,
  clearable,
  filterable,
  placeholder = DEFAULT_PLACEHOLDER,
}: SelectNGProps<T>) {
  const { setPopperElement, triggerRef, filterOptions, popperProps, setPopperRef } = useSelect<T>({
    options,
    placement,
  });

  return (
    <>
      <Downshift
        initialSelectedItem={value === null ? undefined : value}
        itemToString={itemToString}
        onSelect={item => {
          onChange(item);
        }}
      >
        {({
          getInputProps,
          getToggleButtonProps,
          getMenuProps,
          getItemProps,
          isOpen,
          highlightedIndex,
          selectedItem,
          inputValue,
          openMenu,
          closeMenu,
          clearSelection,
        }) => {
          const dropdownButton = renderDropdownButton(triggerRef, isOpen, !!disabled, getToggleButtonProps);
          const clearButton = clearable && selectedItem && renderClearButton(!!disabled, clearSelection);
          const triggerElement = renderDefaultTrigger(
            triggerRef,
            placeholder,
            isOpen,
            !!disabled,
            !!clearable,
            !!filterable,
            dropdownButton,
            clearButton,
            getInputProps,
            {
              openMenu,
              closeMenu,
            }
          );

          return (
            <div>
              <div
                ref={el => {
                  setPopperRef(el);
                }}
              >
                {triggerElement}
                {isOpen ? (
                  <div
                    ref={el => {
                      setPopperElement(el);
                    }}
                    {...popperProps}
                  >
                    {options.length === 0 && <SelectMenuMessage text={noOptionsMessage} />}
                    <SelectMenu
                      {...getMenuProps()}
                      options={filterable ? filterOptions(inputValue) : options}
                      highlightedIndex={highlightedIndex}
                      selectedItem={selectedItem}
                      getItemProps={getItemProps}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        }}
      </Downshift>
    </>
  );
}
