import React from 'react';
import Downshift, { DownshiftProps } from 'downshift';

import { SelectNGProps } from './types';
import {
  itemToString,
  renderDropdownButton,
  renderClearButton,
  renderDefaultToggle,
  DEFAULT_NO_OPTIONS_MESSAGE,
  renderDefaultMenu,
} from './utils';
import { SelectMenuMessage } from './SelectMenu';
import { useSelect, useSelectKeyboardEvents } from './hooks';
import { SelectableValue } from '@grafana/data';

export function SelectNG<T>(props: SelectNGProps<T>) {
  const {
    options,
    clearable,
    filterable,
    placement = 'auto-start',
    noOptionsMessage = DEFAULT_NO_OPTIONS_MESSAGE,
    allowCustomValue,
    removeValueWithBackspace,
    onOptionCreate,
    onChange,
  } = props;
  const { setPopperElement, triggerRef, filterOptions, popperProps, setPopperRef } = useSelect<T>({
    placement,
  });
  const onInputKeyDown = useSelectKeyboardEvents(onChange, onOptionCreate, allowCustomValue, removeValueWithBackspace);

  return (
    <>
      <Downshift {...prepareDownshiftProps(props)}>
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
          const finalOptions = filterable ? filterOptions(options, inputValue) : options;
          const dropdownButton = renderDropdownButton(triggerRef, props, getToggleButtonProps);
          const clearButton = clearable && selectedItem && renderClearButton(props, clearSelection);
          const triggerElement = renderDefaultToggle(
            triggerRef,
            props,
            dropdownButton,
            clearButton,
            (options: any) => {
              const inputProps = getInputProps(options);
              return {
                ...inputProps,
                onKeyDown: onInputKeyDown(finalOptions, selectedItem, highlightedIndex, inputProps.onKeyDown),
              };
            },
            {
              openMenu,
              closeMenu,
            }
          );

          const renderMenu = props.renderMenu || renderDefaultMenu;

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
                    {finalOptions.length === 0 && <SelectMenuMessage text={noOptionsMessage} />}
                    {renderMenu(
                      finalOptions,
                      props,
                      getMenuProps,
                      getItemProps,
                      highlightedIndex,
                      selectedItem,
                      inputValue
                    )}
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

function prepareDownshiftProps<T>(props: SelectNGProps<T>): DownshiftProps<SelectableValue<T>> {
  return {
    // Downshift is used in a controlled way in our implementation
    isOpen: props.isOpen,
    selectedItem: props.value === undefined ? null : props.value,
    onChange: item => {
      props.onChange(item);
    },

    itemToString: itemToString,
  };
}
