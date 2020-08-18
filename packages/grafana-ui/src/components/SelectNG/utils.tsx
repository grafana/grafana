import React from 'react';
import { SelectableValue } from '@grafana/data';
import { DropdownButton } from './DropdownButton';
import { GetToggleButtonPropsOptions, GetInputPropsOptions } from 'downshift';
import { HorizontalGroup } from '../Layout/Layout';
import { IconButton } from '../IconButton/IconButton';
import { Icon } from '../Icon/Icon';
import { Actions } from 'downshift';

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
  isOpen: boolean,
  disabled: boolean,
  getToggleButtonProps: (options?: GetToggleButtonPropsOptions) => void
) => {
  return (
    <DropdownButton
      getToggleButtonProps={getToggleButtonProps}
      isOpen={isOpen}
      onClick={() => {
        // make the dropdown button click focus the trigger
        if (!isOpen) {
          triggerRef.current?.focus();
        }
      }}
      disabled={disabled}
    />
  );
};

export const renderClearButton = (disabled: boolean, clearSelection: () => void) => (
  <IconButton name="times" onClick={() => clearSelection()} disabled={disabled} />
);

export const renderDefaultTrigger = (
  ref: React.RefObject<HTMLInputElement>,
  placeholder: string,
  isOpen: boolean,
  disabled: boolean,
  clearable: boolean,
  filterable: boolean,
  dropdownButton: React.ReactNode,
  clearButton: React.ReactNode,
  getInputProps: (options?: HTMLInputElement) => HTMLInputElement & GetInputPropsOptions,
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
      {...getInputProps()}
      type="text"
      placeholder="Select value..."
      ref={ref as React.RefObject<HTMLInputElement>}
      suffix={suffix}
      disabled={disabled}
      readOnly={!filterable}
      onClick={() => {
        // When Select filtering is disabled, input(set to readonly) clicks toggle the menu
        if (!filterable) {
          if (isOpen) {
            downshiftAPI.closeMenu();
          } else {
            downshiftAPI.openMenu();
          }
        }
      }}
    />
  );
};

export const DEFAULT_PLACEHOLDER = 'Choose option...';
export const DEFAULT_NO_OPTIONS_MESSAGE = 'No options found';
export const DEFAULT_ERROR_MESSAGE = 'Error loading options';
export const DEFAULT_LOADING_MESSAGE = 'Loading options...';
