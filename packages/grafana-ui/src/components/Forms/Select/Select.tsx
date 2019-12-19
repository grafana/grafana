import React from 'react';
import { SelectableValue, deprecationWarning } from '@grafana/data';
// @ts-ignore
import { default as ReactSelect, Creatable, components } from '@torkelo/react-select';
// @ts-ignore
import { default as ReactAsyncSelect } from '@torkelo/react-select/lib/Async';

import { Icon } from '../../Icon/Icon';
import { css } from 'emotion';
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
import { useTheme } from '../../../themes';
import { getSelectStyles } from './getSelectStyles';

type SelectValue<T> = T | SelectableValue<T> | T[] | Array<SelectableValue<T>>;
export interface SelectCommonProps<T> {
  className?: string;
  options?: Array<SelectableValue<T>>;
  defaultValue?: any;
  value?: SelectValue<T>;
  getOptionLabel?: (item: SelectableValue<T>) => string;
  getOptionValue?: (item: SelectableValue<T>) => string;
  onChange: (item: SelectableValue<T>) => {} | void;
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

const getControlComponent = (
  prefix?: JSX.Element | string | null,
  disabled?: boolean,
  invalid?: boolean,
  controlComponent?: React.ComponentType<CustomControlProps<any>>
) => (props: any) => {
  const {
    children,
    innerProps: { ref, ...restInnerProps },
    selectProps: { menuIsOpen, onMenuClose, onMenuOpen },
    isFocused,
    isMulti,
    getValue,
  } = props;
  let value;

  if (!isMulti) {
    value = getValue()[0];
  } else {
    // TODO: handle Multi select...
  }

  if (controlComponent) {
    return React.createElement(controlComponent, {
      isOpen: menuIsOpen,
      value,
      ref,
      onClick: menuIsOpen ? onMenuClose : onMenuOpen,
      onBlur: onMenuClose,
      disabled: !!disabled,
      invalid: !!invalid,
    });
  }

  return (
    <InputControl
      ref={ref}
      innerProps={restInnerProps}
      prefix={prefix}
      isFocused={isFocused}
      invalid={!!invalid}
      disabled={!!disabled}
    >
      {children}
    </InputControl>
  );
};

export function SelectBase<T>({
  value,
  defaultValue,
  options = [],
  onChange,
  onBlur,
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
  openMenuOnFocus = true,
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
}: SelectBaseProps<T>) {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  let Component: ReactSelect | Creatable = ReactSelect;
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
    placeholder,
    isSearchable,
    isDisabled: disabled,
    isClearable,
    isLoading,
    menuIsOpen: isOpen,
    autoFocus: true,
    defaultValue,
    value: isMulti ? selectedValue : selectedValue[0],
    getOptionLabel,
    getOptionValue,
    openMenuOnFocus: false,
    maxMenuHeight,
    isMulti,
    backspaceRemovesValue,
    onMenuOpen: onOpenMenu,
    onMenuClose: onCloseMenu,
    tabSelectsValue,
    options,
    onChange,
    onBlur,
    menuShouldScrollIntoView: false,
  };

  // width property is deprecated in favor of size or className
  let widthClass = '';
  if (width) {
    deprecationWarning('Select', 'width property', 'size or className');
    widthClass = 'width-' + width;
  }

  if (allowCustomValue) {
    Component = Creatable;
    creatableProps.formatCreateLabel = formatCreateLabel ?? ((input: string) => `Create: ${input}`);
  }

  // Instead of having AsyncSelect, as a separate component we render ReactAsyncSelect
  if (loadOptions) {
    Component = ReactAsyncSelect;
    asyncSelectProps = {
      loadOptions,
      defaultOptions,
    };
  }

  return (
    <Component
      components={{
        MenuList: SelectMenu,
        Group: SelectOptionGroup,
        ValueContainer: ValueContainer,
        IndicatorsContainer: IndicatorsContainer,
        IndicatorSeparator: () => <></>,
        Control: getControlComponent(prefix, disabled, invalid, renderControl),
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
          return <div className={styles.loadingMessage}>{noOptionsMessage}</div>;
        },
        DropdownIndicator: (props: any) => <DropdownIndicator isOpen={props.selectProps.menuIsOpen} />,
        SingleValue: SingleValue,
      }}
      styles={{
        ...resetSelectStyles(),
        singleValue: () => {
          return css`
            overflow: hidden;
          `;
        },
        container: () => {
          return css`
            position: relative;
            ${inputSizes()[size]}
          `;
        },
        placeholder: () => {
          return css`
            display: inline-block;
            color: hsl(0, 0%, 50%);
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            box-sizing: border-box;
            line-height: 1;
          `;
        },
      }}
      className={widthClass}
      {...commonSelectProps}
      {...creatableProps}
      {...asyncSelectProps}
    />
  );
}

export function Select<T>(props: SelectCommonProps<T>) {
  return <SelectBase {...props} />;
}

export function MultiSelect<T>(props: MultiSelectCommonProps<T>) {
  // @ts-ignore
  return <SelectBase {...props} isMulti />;
}

interface AsyncSelectProps<T> extends Omit<SelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: SelectableValue<T>;
}

export function AsyncSelect<T>(props: AsyncSelectProps<T>) {
  return <SelectBase {...props} />;
}

interface AsyncMultiSelectProps<T> extends Omit<MultiSelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: Array<SelectableValue<T>>;
}

export function AsyncMultiSelect<T>(props: AsyncMultiSelectProps<T>) {
  // @ts-ignore
  return <SelectBase {...props} isMulti />;
}
