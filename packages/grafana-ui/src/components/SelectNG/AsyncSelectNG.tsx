import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Fetch } from './Fetch';
import Downshift from 'downshift';
import { AsyncSelectNGProps } from './types';
import { SelectMenu, SelectMenuMessage } from './SelectMenu';
import {
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_LOADING_MESSAGE,
  DEFAULT_NO_OPTIONS_MESSAGE,
  DEFAULT_PLACEHOLDER,
  itemToString,
  renderClearButton,
  renderDefaultTrigger,
  renderDropdownButton,
} from './utils';
import { useAsyncSelect } from './hooks';

export function AsyncSelectNG<T>({
  onChange,
  loadOptions,
  clearable,
  disabled,
  filterable,
  placeholder = DEFAULT_PLACEHOLDER,
  noOptionsMessage = DEFAULT_NO_OPTIONS_MESSAGE,
  loadingMessage = DEFAULT_LOADING_MESSAGE,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  placement = 'auto-start',
}: AsyncSelectNGProps<T>) {
  const {
    triggerRef,
    popperProps,
    currentValue,
    onLoadOptions,
    setPopperRef,
    setPopperElement,
    setCurrentValue,
  } = useAsyncSelect<T>({
    placement,
    loadOptions,
  });
  return (
    <>
      <Downshift
        itemToString={itemToString}
        onSelect={onChange}
        onInputValueChange={v => {
          setCurrentValue(v);
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
          clearSelection,
          closeMenu,
          openMenu,
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
                    <Fetch<any, Array<SelectableValue<T>>> loadData={onLoadOptions.current} query={currentValue}>
                      {data => {
                        if (data.error) {
                          return <SelectMenuMessage text={errorMessage} />;
                        }
                        if (data.loading) {
                          return <SelectMenuMessage text={loadingMessage} />;
                        }

                        if (data.value && data.value.length === 0) {
                          return <SelectMenuMessage text={noOptionsMessage} />;
                        }

                        if (data.value) {
                          return (
                            <SelectMenu
                              {...getMenuProps()}
                              options={data.value}
                              highlightedIndex={highlightedIndex}
                              selectedItem={selectedItem}
                              getItemProps={getItemProps}
                            />
                          );
                        }

                        return <></>;
                      }}
                    </Fetch>
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
