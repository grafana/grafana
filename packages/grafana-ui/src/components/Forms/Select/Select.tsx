import React from 'react';
import { SelectableValue } from '@grafana/data';
// @ts-ignore
import { default as ReactSelect, Creatable, components } from '@torkelo/react-select';
import { Icon } from '../../Icon/Icon';
import { css } from 'emotion';
import { inputSizes } from '../commonStyles';
import { FormInputSize } from '../types';
import resetSelectStyles from './resetSelectStyles';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { SingleValue } from './SingleValue';
import { IndicatorsContainer } from './IndicatorsContainer';
import { ValueContainer } from './ValueContainer';
import { InputControl } from './InputControl';
import { DropdownIndicator } from './DropdownIndicator';

export interface SelectCommonProps<T> {
  defaultValue?: any;
  getOptionLabel?: (item: SelectableValue<T>) => string;
  getOptionValue?: (item: SelectableValue<T>) => string;
  onChange: (item: SelectableValue<T>) => {} | void;
  placeholder?: string;
  width?: number;
  value?: SelectableValue<T>;
  isDisabled?: boolean;
  isSearchable?: boolean;
  isClearable?: boolean;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  onBlur?: () => void;
  maxMenuHeight?: number;
  isLoading?: boolean;
  noOptionsMessage?: () => string;
  isMulti?: boolean;
  backspaceRemovesValue?: boolean;
  isOpen?: boolean;
  components?: any;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  tabSelectsValue?: boolean;
  formatCreateLabel?: (input: string) => string;
  allowCustomValue?: boolean;
  size?: FormInputSize;
  /** Renders value */
  renderValue?: (v: SelectableValue<T>) => JSX.Element;
  /** Renders custom label for a single option in the menu */
  renderOptionLabel?: (v: SelectableValue<T>) => JSX.Element;
  prefix?: JSX.Element | string | null;
}

export interface SelectProps<T> extends SelectCommonProps<T> {
  options: Array<SelectableValue<T>>;
}

const renderControl = (prefix?: JSX.Element | string | null) => (props: any) => {
  const {
    children,
    innerProps: { ref, ...restInnerProps },
    isFocused,
  } = props;
  console.log(props.selectProps);
  return (
    <InputControl ref={ref} innerProps={restInnerProps} isFocused={isFocused} prefix={prefix}>
      {children}
    </InputControl>
  );
};

export function Select<T>({
  value,
  defaultValue,
  options,
  onChange,
  onBlur,
  onCloseMenu,
  onOpenMenu,
  placeholder,
  getOptionValue,
  getOptionLabel,
  isSearchable = true,
  isDisabled = false,
  isClearable = false,
  isMulti = false,
  isLoading = false,
  isOpen,
  autoFocus = false,
  openMenuOnFocus = true,
  maxMenuHeight = 300,
  noOptionsMessage,
  tabSelectsValue = true,
  backspaceRemovesValue = true,
  allowCustomValue = true,
  size = 'auto',
  renderValue,
  renderOptionLabel,
  prefix,
  formatCreateLabel,
}: SelectProps<T>) {
  let Component: ReactSelect | Creatable = ReactSelect;
  // const selectedValue = options.filter(o => o.value === value)[0];
  const creatableOptions: any = {};

  if (allowCustomValue) {
    Component = Creatable;
    creatableOptions.formatCreateLabel = formatCreateLabel ?? ((input: string) => `Create: ${input}`);
  }

  return (
    <Component
      options={options}
      onChange={onChange}
      onBlur={onBlur}
      components={{
        MenuList: SelectMenu,
        ValueContainer: ValueContainer,
        IndicatorsContainer: IndicatorsContainer,
        IndicatorSeparator: () => null,
        Control: renderControl(prefix),
        Option: (props: any) => <SelectMenuOptions {...props} renderOptionLabel={renderOptionLabel} />,
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
        DropdownIndicator: (props: any) => <DropdownIndicator isOpen={props.menuIsOpen} />,
        SingleValue: (props: any) => <SingleValue {...props} value={value} renderValue={renderValue} />,
      }}
      styles={{
        ...resetSelectStyles(),
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
      menuShouldScrollIntoView={false}
      placeholder={placeholder || 'Choose'}
      isSearchable={isSearchable}
      isDisabled={isDisabled}
      isClearable={isClearable}
      menuIsOpen={isOpen}
      autoFocus={autoFocus}
      defaultValue={defaultValue}
      value={value}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      isLoading={isLoading}
      openMenuOnFocus={openMenuOnFocus}
      maxMenuHeight={maxMenuHeight}
      noOptionsMessage={noOptionsMessage}
      isMulti={isMulti}
      backspaceRemovesValue={true}
      onMenuOpen={onOpenMenu}
      onMenuClose={onCloseMenu}
      tabSelectsValue={tabSelectsValue}
      {...creatableOptions}
    />
  );
}
