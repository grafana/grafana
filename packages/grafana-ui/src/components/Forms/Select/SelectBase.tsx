import React from 'react';
import { SelectableValue, deprecationWarning } from '@grafana/data';
// @ts-ignore
import { default as ReactSelect } from '@torkelo/react-select';
// @ts-ignore
import Creatable from '@torkelo/react-select/creatable';
// @ts-ignore
import { default as ReactAsyncSelect } from '@torkelo/react-select/async';
// @ts-ignore
import { default as AsyncCreatable } from '@torkelo/react-select/async-creatable';

import { Icon } from '../../Icon/Icon';
import { css, cx } from 'emotion';
import { inputSizes } from '../commonStyles';
import { FormInputSize } from '../types';
import resetSelectStyles from './resetSelectStyles';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { IndicatorsContainer } from './IndicatorsContainer';
import { ValueContainer } from './ValueContainer';
import { InputControl } from './InputControl';
import { DropdownIndicator } from './DropdownIndicator';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SingleValue } from './SingleValue';
import { MultiValueContainer, MultiValueRemove } from './MultiValue';
import { useTheme } from '../../../themes';
import { getSelectStyles } from './getSelectStyles';

type SelectValue<T> = T | SelectableValue<T> | T[] | Array<SelectableValue<T>>;

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
  renderControl?: ControlComponent<T>;
}

export interface SelectAsyncProps<T> {
  /** When specified as boolean the loadOptions will execute when component is mounted */
  defaultOptions?: boolean | Array<SelectableValue<T>>;
  /** Asynchroniously load select options */
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

const CustomControl = (props: any) => {
  const {
    children,
    innerProps,
    selectProps: { menuIsOpen, onMenuClose, onMenuOpen },
    isFocused,
    isMulti,
    getValue,
    innerRef,
  } = props;
  const selectProps = props.selectProps as SelectBaseProps<any>;

  if (selectProps.renderControl) {
    return React.createElement(selectProps.renderControl, {
      isOpen: menuIsOpen,
      value: isMulti ? getValue() : getValue()[0],
      ref: innerRef,
      onClick: menuIsOpen ? onMenuClose : onMenuOpen,
      onBlur: onMenuClose,
      disabled: !!selectProps.disabled,
      invalid: !!selectProps.invalid,
    });
  }

  return (
    <InputControl
      ref={innerRef}
      innerProps={innerProps}
      prefix={selectProps.prefix}
      focused={isFocused}
      invalid={!!selectProps.invalid}
      disabled={!!selectProps.disabled}
    >
      {children}
    </InputControl>
  );
};

export function SelectBase<T>({
  value,
  defaultValue,
  inputValue,
  onInputChange,
  onCreateOption,
  options = [],
  onChange,
  onBlur,
  onKeyDown,
  onCloseMenu,
  onOpenMenu,
  placeholder = 'Choose',
  getOptionValue,
  getOptionLabel,
  isSearchable = true,
  disabled = false,
  isClearable = false,
  isMulti = false,
  isLoading = false,
  isOpen,
  autoFocus = false,
  openMenuOnFocus = false,
  maxMenuHeight = 300,
  noOptionsMessage = 'No options found',
  tabSelectsValue = true,
  backspaceRemovesValue = true,
  allowCustomValue = false,
  size = 'auto',
  prefix,
  formatCreateLabel,
  loadOptions,
  loadingMessage = 'Loading options...',
  defaultOptions,
  renderControl,
  width,
  invalid,
  components,
}: SelectBaseProps<T>) {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  let ReactSelectComponent: ReactSelect | Creatable = ReactSelect;
  const creatableProps: any = {};
  let asyncSelectProps: any = {};

  let selectedValue = [];
  if (isMulti && loadOptions) {
    selectedValue = value as any;
  } else {
    // If option is passed as a plain value (value property from SelectableValue property)
    // we are selecting the corresponding value from the options
    if (isMulti && value && Array.isArray(value) && !loadOptions) {
      // @ts-ignore
      selectedValue = value.map(v => {
        return options.filter(o => {
          return v === o.value || o.value === v.value;
        })[0];
      });
    } else {
      selectedValue = options.filter(o => o.value === value || o === value);
    }
  }

  const commonSelectProps = {
    autoFocus,
    placeholder,
    isSearchable,
    // Passing isDisabled as react-select accepts this prop
    isDisabled: disabled,
    // Also passing disabled, as this is the new Select API, and I want to use this prop instead of react-select's one
    disabled,
    invalid,
    prefix,
    isClearable,
    isLoading,
    menuIsOpen: isOpen,
    defaultValue,
    inputValue,
    onInputChange,
    value: isMulti ? selectedValue : selectedValue[0],
    getOptionLabel,
    getOptionValue,
    openMenuOnFocus,
    maxMenuHeight,
    isMulti,
    backspaceRemovesValue,
    onMenuOpen: onOpenMenu,
    onMenuClose: onCloseMenu,
    tabSelectsValue,
    options,
    onChange,
    onBlur,
    onKeyDown,
    menuShouldScrollIntoView: false,
    renderControl,
    captureMenuScroll: false,
  };

  // width property is deprecated in favor of size or className
  let widthClass = '';
  if (width) {
    deprecationWarning('Select', 'width property', 'size or className');
    widthClass = 'width-' + width;
  }

  if (allowCustomValue) {
    ReactSelectComponent = Creatable;
    creatableProps.formatCreateLabel = formatCreateLabel ?? ((input: string) => `Create: ${input}`);
    creatableProps.onCreateOption = onCreateOption;
  }

  // Instead of having AsyncSelect, as a separate component we render ReactAsyncSelect
  if (loadOptions) {
    ReactSelectComponent = allowCustomValue ? AsyncCreatable : ReactAsyncSelect;
    asyncSelectProps = {
      loadOptions,
      defaultOptions,
    };
  }

  return (
    <ReactSelectComponent
      components={{
        MenuList: SelectMenu,
        Group: SelectOptionGroup,
        ValueContainer: ValueContainer,
        Placeholder: (props: any) => (
          <div
            {...props.innerProps}
            className={cx(
              css(props.getStyles('placeholder', props)),
              css`
                display: inline-block;
                color: hsl(0, 0%, 50%);
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                box-sizing: border-box;
                line-height: 1;
              `
            )}
          >
            {props.children}
          </div>
        ),
        SelectContainer: (props: any) => (
          <div
            {...props.innerProps}
            className={cx(
              css(props.getStyles('container', props)),
              css`
                position: relative;
              `,
              inputSizes()[size]
            )}
          >
            {props.children}
          </div>
        ),
        IndicatorsContainer: IndicatorsContainer,
        IndicatorSeparator: () => <></>,
        Control: CustomControl,
        Option: SelectMenuOptions,
        ClearIndicator: (props: any) => {
          const { clearValue } = props;
          return (
            <Icon
              name="times"
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                clearValue();
              }}
            />
          );
        },
        LoadingIndicator: (props: any) => {
          return <Icon name="spinner" className="fa fa-spin" />;
        },
        LoadingMessage: (props: any) => {
          return <div className={styles.loadingMessage}>{loadingMessage}</div>;
        },
        NoOptionsMessage: (props: any) => {
          return (
            <div className={styles.loadingMessage} aria-label="No options provided">
              {noOptionsMessage}
            </div>
          );
        },
        DropdownIndicator: (props: any) => <DropdownIndicator isOpen={props.selectProps.menuIsOpen} />,
        SingleValue: SingleValue,
        MultiValueContainer: MultiValueContainer,
        MultiValueRemove: MultiValueRemove,
        ...components,
      }}
      styles={{
        ...resetSelectStyles(),
      }}
      className={widthClass}
      {...commonSelectProps}
      {...creatableProps}
      {...asyncSelectProps}
    />
  );
}
