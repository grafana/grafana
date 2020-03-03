import { SelectableValue } from '@grafana/data';
import React from 'react';
import { FormInputSize } from '../types';

export type SelectValue<T> = T | SelectableValue<T> | T[] | Array<SelectableValue<T>>;

export interface SelectCommonProps<T> {
  className?: string;
  options?: Array<SelectableValue<T>>;
  defaultValue?: any;
  inputValue?: string;
  value?: SelectValue<T>;
  getOptionLabel?: (item: SelectableValue<T>) => string;
  getOptionValue?: (item: SelectableValue<T>) => string;
  onCreateOption?: (value: string) => void;
  onChange: (value: SelectableValue<T>) => {} | void;
  onInputChange?: (label: string) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  isSearchable?: boolean;
  isClearable?: boolean;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  onBlur?: () => void;
  maxMenuHeight?: number;
  isLoading?: boolean;
  noOptionsMessage?: string;
  isMulti?: boolean;
  backspaceRemovesValue?: boolean;
  isOpen?: boolean;
  components?: any;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  tabSelectsValue?: boolean;
  formatCreateLabel?: (input: string) => string;
  allowCustomValue?: boolean;
  width?: number;
  size?: FormInputSize;
  /** item to be rendered in front of the input */
  prefix?: JSX.Element | string | null;
  /** Use a custom element to control Select. A proper ref to the renderControl is needed if 'portal' isn't set to null*/
  renderControl?: ControlComponent<T>;
  menuPosition?: 'fixed' | 'absolute';
}

export interface SelectAsyncProps<T> {
  /** When specified as boolean the loadOptions will execute when component is mounted */
  defaultOptions?: boolean | Array<SelectableValue<T>>;
  /** Asynchronously load select options */
  loadOptions?: (query: string) => Promise<Array<SelectableValue<T>>>;
  /** Message to display when options are loading */
  loadingMessage?: string;
}

export interface MultiSelectCommonProps<T> extends Omit<SelectCommonProps<T>, 'onChange' | 'isMulti' | 'value'> {
  value?: Array<SelectableValue<T>> | T[];
  onChange: (item: Array<SelectableValue<T>>) => {} | void;
}

export interface SelectBaseProps<T> extends SelectCommonProps<T>, SelectAsyncProps<T> {
  invalid?: boolean;
}

export interface CustomControlProps<T> {
  ref: React.Ref<any>;
  isOpen: boolean;
  /** Currently selected value */
  value?: SelectableValue<T>;
  /** onClick will be automatically passed to custom control allowing menu toggle */
  onClick: () => void;
  /** onBlur will be automatically passed to custom control closing the menu on element blur */
  onBlur: () => void;
  disabled: boolean;
  invalid: boolean;
}

export type ControlComponent<T> = React.ComponentType<CustomControlProps<T>>;

export interface SelectableOptGroup<T = any> {
  label: string;
  options: Array<SelectableValue<T>>;
  [key: string]: any;
}

export type SelectOptions<T = any> =
  | SelectableValue<T>
  | Array<SelectableValue<T> | SelectableOptGroup<T> | Array<SelectableOptGroup<T>>>;
