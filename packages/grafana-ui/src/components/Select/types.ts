import React from 'react';
import {
  ActionMeta as SelectActionMeta,
  CommonProps as ReactSelectCommonProps,
  GroupBase,
  OptionsOrGroups,
} from 'react-select';

import { SelectableValue } from '@grafana/data';

export type SelectValue<T> = T | SelectableValue<T> | T[] | Array<SelectableValue<T>>;
export type ActionMeta = SelectActionMeta<{}>;
export type InputActionMeta = {
  action: 'set-value' | 'input-change' | 'input-blur' | 'menu-close';
};
export type LoadOptionsCallback<T> = (options: Array<SelectableValue<T>>) => void;

export interface SelectCommonProps<T> {
  /** Aria label applied to the input field */
  ['aria-label']?: string;
  allowCreateWhileLoading?: boolean;
  allowCustomValue?: boolean;
  /** Focus is set to the Select when rendered*/
  autoFocus?: boolean;
  backspaceRemovesValue?: boolean;
  className?: string;
  closeMenuOnSelect?: boolean;
  /** Used for custom components. For more information, see `react-select` */
  components?: any;
  /** Sets the position of the createOption element in your options list. Defaults to 'last' */
  createOptionPosition?: 'first' | 'last';
  defaultValue?: any;
  disabled?: boolean;
  filterOption?: (option: SelectableValue<T>, searchQuery: string) => boolean;
  formatOptionLabel?: (item: SelectableValue<T>, formatOptionMeta: FormatOptionLabelMeta<T>) => React.ReactNode;
  /** Function for formatting the text that is displayed when creating a new value*/
  formatCreateLabel?: (input: string) => string;
  getOptionLabel?: (item: SelectableValue<T>) => React.ReactNode;
  getOptionValue?: (item: SelectableValue<T>) => string;
  hideSelectedOptions?: boolean;
  inputValue?: string;
  invalid?: boolean;
  isClearable?: boolean;
  /** The id to set on the SelectContainer component. To set the id for a label (with htmlFor), @see inputId instead */
  id?: string;
  isLoading?: boolean;
  isMulti?: boolean;
  /** The id of the search input. Use this to set a matching label with htmlFor */
  inputId?: string;
  isOpen?: boolean;
  /** Disables the possibility to type into the input*/
  isSearchable?: boolean;
  showAllSelectedWhenOpen?: boolean;
  maxMenuHeight?: number;
  minMenuHeight?: number;
  maxVisibleValues?: number;
  menuPlacement?: 'auto' | 'bottom' | 'top';
  menuPosition?: 'fixed' | 'absolute';
  /**
   * Setting to false will prevent the menu from portalling to the body.
   */
  menuShouldPortal?: boolean;
  /** The message to display when no options could be found */
  noOptionsMessage?: string;
  onBlur?: () => void;
  onChange: (value: SelectableValue<T>, actionMeta: ActionMeta) => {} | void;
  onCloseMenu?: () => void;
  /** allowCustomValue must be enabled. Function decides what to do with that custom value. */
  onCreateOption?: (value: string) => void;
  onInputChange?: (value: string, actionMeta: InputActionMeta) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onOpenMenu?: () => void;
  onFocus?: () => void;
  openMenuOnFocus?: boolean;
  options?: Array<SelectableValue<T>>;
  placeholder?: string;
  /** item to be rendered in front of the input */
  prefix?: JSX.Element | string | null;
  /** Use a custom element to control Select. A proper ref to the renderControl is needed if 'portal' isn't set to null*/
  renderControl?: ControlComponent<T>;
  tabSelectsValue?: boolean;
  value?: T | SelectValue<T> | null;
  /** Will wrap the MenuList in a react-window FixedSizeVirtualList for improved performance, does not support options with "description" properties */
  virtualized?: boolean;
  /** Sets the width to a multiple of 8px. Should only be used with inline forms. Setting width of the container is preferred in other cases.*/
  width?: number | 'auto';
  isOptionDisabled?: () => boolean;
  /** allowCustomValue must be enabled. Determines whether the "create new" option should be displayed based on the current input value, select value and options array. */
  isValidNewOption?: (
    inputValue: string,
    value: SelectableValue<T> | null,
    options: OptionsOrGroups<SelectableValue<T>, GroupBase<SelectableValue<T>>>
  ) => boolean;
  /** Message to display isLoading=true*/
  loadingMessage?: string;
}

export interface SelectAsyncProps<T> {
  /** When specified as boolean the loadOptions will execute when component is mounted */
  defaultOptions?: boolean | Array<SelectableValue<T>>;

  /** Asynchronously load select options */
  loadOptions?: (query: string, cb?: LoadOptionsCallback<T>) => Promise<Array<SelectableValue<T>>> | void;

  /** If cacheOptions is true, then the loaded data will be cached. The cache will remain until cacheOptions changes value. */
  cacheOptions?: boolean;
  /** Message to display when options are loading */
  loadingMessage?: string;
}

/** The VirtualizedSelect component uses a slightly different SelectableValue, description and other props are not supported */
export interface VirtualizedSelectProps<T> extends Omit<SelectCommonProps<T>, 'virtualized'> {
  options?: Array<Pick<SelectableValue<T>, 'label' | 'value'>>;
}

/** The AsyncVirtualizedSelect component uses a slightly different SelectableValue, description and other props are not supported */
export interface VirtualizedSelectAsyncProps<T>
  extends Omit<SelectCommonProps<T>, 'virtualized'>,
    SelectAsyncProps<T> {}

export interface MultiSelectCommonProps<T> extends Omit<SelectCommonProps<T>, 'onChange' | 'isMulti' | 'value'> {
  value?: Array<SelectableValue<T>> | T[];
  onChange: (item: Array<SelectableValue<T>>, actionMeta: ActionMeta) => {} | void;
}

// This is the type of *our* SelectBase component, not ReactSelect's prop, although
// they should be mostly compatible.
export interface SelectBaseProps<T> extends SelectCommonProps<T>, SelectAsyncProps<T> {
  invalid?: boolean;
}

// This is used for the `renderControl` prop on *our* SelectBase component
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

export type FormatOptionLabelMeta<T> = { context: string; inputValue: string; selectValue: Array<SelectableValue<T>> };

// This is the type of `selectProps` our custom components (like SelectContainer, etc) recieve
// It's slightly different to the base react select props because we pass in additional props directly to
// react select
export type ReactSelectProps<Option, IsMulti extends boolean, Group extends GroupBase<Option>> = ReactSelectCommonProps<
  Option,
  IsMulti,
  Group
>['selectProps'] & {
  invalid: boolean;
};

// Use this type when implementing custom components for react select.
// See SelectContainerProps in SelectContainer.tsx
export interface CustomComponentProps<Option, isMulti extends boolean, Group extends GroupBase<Option>> {
  selectProps: ReactSelectProps<Option, isMulti, Group>;
}
