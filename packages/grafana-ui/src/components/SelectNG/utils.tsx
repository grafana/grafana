import React from 'react';
import { SelectableValue } from '@grafana/data';
import { DropdownButton } from './DropdownButton';
import { GetToggleButtonPropsOptions, GetInputPropsOptions } from 'downshift';
import { HorizontalGroup } from '../Layout/Layout';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Actions } from 'downshift';
import { selectors } from '@grafana/e2e-selectors';
import { SelectMenuOptionRenderer, SelectMenuOptionsGroupRenderer, SelectMenuRenderer, SelectNGProps } from './types';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SelectMenu, SelectMenuOption } from './SelectMenu';

// Ref: https://codesandbox.io/s/bitter-sky-pe3z9?file=/src/index.js
// https://popper.js.org/docs/v2/modifiers/community-modifiers
export const minSameWidthModifier = {
  name: 'sameWidth',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['computeStyles'],
  fn: ({ state }: any) => {
    state.styles.popper.minWidth = `${state.rects.reference.width}px`;
    state.styles.popper.width = `auto`;
  },
  effect: ({ state }: any) => {
    state.elements.popper.style.minWidth = `${state.elements.reference.offsetWidth}px`;
    state.elements.popper.style.width = `auto`;
  },
};

// Converts SelectableValue to human-readable representation
// Needs customization via props probably, similar to getOptionLabel
export const itemToString = (value: SelectableValue | null) => value?.label || '';

// Will need some customization most probably
export const renderDropdownButton = (
  triggerRef: React.RefObject<HTMLElement>,
  props: SelectNGProps<any>,
  getToggleButtonProps: (options?: GetToggleButtonPropsOptions) => void
) => {
  return (
    <DropdownButton
      getToggleButtonProps={getToggleButtonProps}
      isOpen={!!props.isOpen}
      onClick={() => {
        // make the dropdown button click focus the trigger
        if (!props.isOpen) {
          triggerRef.current?.focus();
        }
      }}
      disabled={props.disabled}
    />
  );
};

export const renderClearButton = (props: SelectNGProps<any>, clearSelection: () => void) => (
  <IconButton name="times" onClick={() => clearSelection()} disabled={props.disabled} />
);

export const renderDefaultToggle = (
  ref: React.RefObject<HTMLInputElement>,
  props: SelectNGProps<any>,
  dropdownButton: React.ReactNode,
  clearButton: React.ReactNode,
  getInputProps: (options?: any) => GetInputPropsOptions,
  downshiftAPI: Pick<Actions<any>, 'openMenu' | 'closeMenu'>
) => {
  const suffix = (
    <HorizontalGroup spacing="xs">
      {clearButton}
      {dropdownButton}
    </HorizontalGroup>
  );
  return (
    <Input
      {...getInputProps({
        'aria-label': selectors.components.Select.trigger,
      })}
      type="text"
      placeholder={props.placeholder || DEFAULT_PLACEHOLDER}
      ref={ref as React.RefObject<HTMLInputElement>}
      suffix={suffix}
      disabled={props.disabled}
      readOnly={!props.filterable}
      onClick={() => {
        // When Select filtering is disabled, input(set to readonly) clicks toggle the menu
        if (!props.filterable) {
          if (props.isOpen) {
            downshiftAPI.closeMenu();
          } else {
            downshiftAPI.openMenu();
          }
        }
      }}
    />
  );
};

export const renderDefaultGroup: SelectMenuOptionsGroupRenderer<any> = (
  option,
  props,
  getItemProps,
  index,
  highlightedIndex
) => {
  const renderOption = props.renderOption || renderDefaultOption;
  return (
    <SelectOptionGroup
      option={option as any}
      index={index}
      getItemProps={getItemProps}
      renderOption={(o, index) => {
        return renderOption(o, props, getItemProps, index, highlightedIndex);
      }}
    />
  );
};

export const renderDefaultOption: SelectMenuOptionRenderer<any> = (
  option,
  props,
  getItemProps,
  index,
  highlightedIndex: number
) => {
  if (option.options) {
    return props.renderOptionsGroup
      ? props.renderOptionsGroup(option, props, getItemProps, index, highlightedIndex)
      : renderDefaultGroup(option, props, getItemProps, index, highlightedIndex);
  }

  // console.log(getItemProps({ item: option, index }))
  return (
    <SelectMenuOption item={option} {...getItemProps({ item: option, index })} isFocused={index === highlightedIndex} />
  );
};

export const renderDefaultMenu: SelectMenuRenderer<any> = (
  options,
  props,
  getMenuProps,
  getItemProps,
  highlightedIndex,
  selectedOption,
  inputValue
) => {
  const renderOption = props.renderOption || renderDefaultOption;

  return (
    <SelectMenu
      {...getMenuProps()}
      options={options}
      highlightedIndex={highlightedIndex}
      selectedItem={selectedOption}
      getItemProps={getItemProps}
      inputValue={inputValue}
      enableOptionCreation={props.allowCustomValue}
      onOptionCreate={props.onOptionCreate}
      renderOption={(o, _getItemProps, index, highlightedIndex) =>
        renderOption(o, props, _getItemProps, index, highlightedIndex)
      }
    />
  );
};

export const flattenOptions = (options: SelectableValue[]) => {
  return options.reduce((acc, item) => {
    const resultOption = { ...item };

    if (item.options) {
      const flattened = flattenOptions(resultOption.options);
      if (flattened.length > 0) {
        acc.push(flattened);
      }
    } else {
      acc.push(resultOption);
    }

    return acc;
  }, [] as SelectableValue[]);
};

// Allow option creation when there is no exact match between any of the options and the input value
export function shouldAllowOptionCreate(options: SelectableValue[], inputValue?: string) {
  if (!inputValue || inputValue.trim() === '') {
    return false;
  }
  return flattenOptions(options).filter(o => o.label === inputValue).length === 0;
}

export const DEFAULT_PLACEHOLDER = 'Choose option...';
export const DEFAULT_NO_OPTIONS_MESSAGE = 'No options found';
export const DEFAULT_ERROR_MESSAGE = 'Error loading options';
export const DEFAULT_LOADING_MESSAGE = 'Loading options...';
