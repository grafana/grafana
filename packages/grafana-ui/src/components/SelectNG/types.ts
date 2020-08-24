import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Placement } from '@popperjs/core';
import { GetMenuPropsOptions, GetItemPropsOptions } from 'downshift';

interface SelectBehaviorProps {
  clearable?: boolean;
  filterable?: boolean;
  isOpen?: boolean;
  allowCustomValue?: boolean;
  removeValueWithBackspace?: boolean;
}

interface SelectRenderProps<T> {
  renderMenu?: SelectMenuRenderer<T>;
  renderOption?: SelectMenuOptionRenderer<T>;
  renderOptionsGroup?: SelectMenuOptionsGroupRenderer<T>;
}

export type SelectMenuOptionsGroupRenderer<T> = (
  option: SelectableValue<T>,
  props: SelectNGProps<T>,
  getItemProps: (options: GetItemPropsOptions<SelectableValue<T>>) => any,
  index: number,
  highlightedIndex: number
) => React.ReactNode;

export type SelectMenuOptionRenderer<T> = (
  option: SelectableValue,
  props: SelectNGProps<T>,
  getItemProps: (options: GetItemPropsOptions<SelectableValue<T>>) => any,
  index: number,
  highlightedIndex: number
) => React.ReactNode;

export type SelectMenuRenderer<T> = (
  options: Array<SelectableValue<T>>,
  props: SelectNGProps<T>,
  getMenuProps: (options?: GetMenuPropsOptions) => any,
  getItemProps: (options: GetItemPropsOptions<SelectableValue<T>>) => any,
  highlightedIndex: number | null,
  selectedOption: SelectableValue<T> | null,
  inputValue?: string | null
) => React.ReactNode;

export interface SelectNGProps<T>
  extends SelectBehaviorProps,
    SelectRenderProps<T>,
    Omit<React.HTMLProps<HTMLSelectElement>, 'value'> {
  value?: SelectableValue<T> | null;
  options: Array<SelectableValue<T>>;
  width?: number;
  placement?: Placement; // previously menuPlacement
  noOptionsMessage?: string;
  onChange: (value: SelectableValue<T> | null) => void;
  onOptionCreate?: (value: SelectableValue<T>) => void;
}

export interface AsyncSelectNGProps<T> extends Omit<SelectNGProps<T>, 'options'> {
  loadOptions: AsyncSelectOptionsResolver<T>;
  loadingMessage?: string;
  errorMessage?: string;
}

export type AsyncSelectOptionsResolver<T> = (query: string | null) => Promise<Array<SelectableValue<T>>>;
