import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Fetch } from './Fetch';
import Downshift from 'downshift';
import { AsyncSelectNGProps, SelectNGProps } from './types';
import { SelectMenu, SelectMenuMessage } from './SelectMenu';
import {
  DEFAULT_ERROR_MESSAGE,
  DEFAULT_LOADING_MESSAGE,
  DEFAULT_NO_OPTIONS_MESSAGE,
  itemToString,
  renderClearButton,
  renderDefaultToggle,
  renderDropdownButton,
} from './utils';
import { useAsyncSelect, useSelectKeyboardEvents } from './hooks';

export function AsyncSelectNG<T>(props: AsyncSelectNGProps<T>) {
  const {
    onChange,
    loadOptions,
    clearable,
    filterable,
    noOptionsMessage = DEFAULT_NO_OPTIONS_MESSAGE,
    loadingMessage = DEFAULT_LOADING_MESSAGE,
    errorMessage = DEFAULT_ERROR_MESSAGE,
    placement = 'auto-start',
    onOptionCreate,
    allowCustomValue,
    removeValueWithBackspace,
  } = props;
  const {
    triggerRef,
    popperProps,
    currentValue,
    onLoadOptions,
    setPopperRef,
    setPopperElement,
    setCurrentValue,
    options,
    filterOptions,
    setOptions,
  } = useAsyncSelect<T>({
    placement,
    loadOptions,
  });

  const onInputKeyDown = useSelectKeyboardEvents(onChange, onOptionCreate, allowCustomValue, removeValueWithBackspace);

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
          const finalOptions = filterable && options ? filterOptions(options, currentValue) : options;

          const dropdownButton = renderDropdownButton(
            triggerRef,
            (props as unknown) as SelectNGProps<any>,
            getToggleButtonProps
          );
          const clearButton =
            clearable && selectedItem && renderClearButton((props as unknown) as SelectNGProps<any>, clearSelection);
          const triggerElement = renderDefaultToggle(
            triggerRef,
            (props as unknown) as SelectNGProps<any>,
            dropdownButton,
            clearButton,
            (options: any) => {
              const inputProps = getInputProps(options);
              return {
                ...inputProps,
                onKeyDown: onInputKeyDown(finalOptions || [], selectedItem, highlightedIndex, inputProps.onKeyDown),
              };
            },
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
                    <Fetch<any, Array<SelectableValue<T>>>
                      loadData={onLoadOptions.current}
                      query={currentValue}
                      onDataLoad={setOptions}
                    >
                      {data => {
                        if (data.error) {
                          return <SelectMenuMessage text={errorMessage} />;
                        }
                        if (data.loading) {
                          return <SelectMenuMessage text={loadingMessage} />;
                        }

                        return (
                          <>
                            {options && options.length === 0 && <SelectMenuMessage text={noOptionsMessage} />}
                            {options && (
                              <SelectMenu
                                {...getMenuProps()}
                                options={options}
                                highlightedIndex={highlightedIndex}
                                selectedItem={selectedItem}
                                getItemProps={getItemProps}
                                inputValue={currentValue}
                                enableOptionCreation={allowCustomValue}
                                onOptionCreate={onOptionCreate}
                              />
                            )}
                          </>
                        );
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
