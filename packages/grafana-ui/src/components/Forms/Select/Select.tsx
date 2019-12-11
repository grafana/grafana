import React from 'react';
import { SelectableValue } from '@grafana/data';
import { getInputStyles } from '../Input/Input';
// @ts-ignore
import { default as ReactSelect, Creatable, components } from '@torkelo/react-select';
// import resetSelectStyles from './resetSelectStyles';
import { Icon } from '../../Icon/Icon';
import { useTheme } from '../../../themes';
import { cx, css } from 'emotion';
import { getFocusCss, inputSizes, sharedInputStyle } from '../commonStyles';
import { FormInputSize } from '../types';
import resetSelectStyles from './resetSelectStyles';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { SingleValue } from './SingleValue';
import { IndicatorsContainer } from './IndicatorsContainer';
import { ValueContainer } from './ValueContainer';
import { InputControl } from './InputControl';

export interface SelectCommonProps<T> {
  defaultValue?: any;
  getOptionLabel?: (item: SelectableValue<T>) => string;
  getOptionValue?: (item: SelectableValue<T>) => string;
  onChange: (item: SelectableValue<T>) => {} | void;
  placeholder?: string;
  width?: number;
  value?: T;
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
  renderValue?: (v: SelectableValue<T>) => JSX.Element;
  renderOptionLabel?: (v: SelectableValue<T>) => JSX.Element;
}

export interface SelectProps<T> extends SelectCommonProps<T> {
  options: Array<SelectableValue<T>>;
}

const renderControl = (props: any) => {
  const {
    children,
    innerProps: { ref, ...restInnerProps },
    isFocused,
  } = props;
  return (
    <InputControl ref={ref} innerProps={restInnerProps} isFocused={isFocused}>
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
}: SelectProps<T>) {
  const SelectComponent: ReactSelect | Creatable = ReactSelect;
  const selectedValue = options.filter(o => o.value === value)[0];
  console.log(selectedValue);

  return (
    // <div className={cx(inputSizes()[size])}>
    <SelectComponent
      options={options}
      onChange={onChange}
      onBlur={onBlur}
      components={{
        MenuList: SelectMenu,
        Control: renderControl,
        Option: (props: any) => <SelectMenuOptions {...props} renderOptionLabel={renderOptionLabel} />,
        ValueContainer: ValueContainer,
        IndicatorsContainer: IndicatorsContainer,
        IndicatorSeparator: () => null,
        ClearIndicator: () => {
          return <Icon name="calendar" />;
        },
        DropdownIndicator: () => {
          return <Icon name="caret-down" />;
        },
        SingleValue: (props: any) => <SingleValue {...props} value={selectedValue} renderValue={renderValue} />,
        Placeholder: (props: any) => {
          const { innerProps, children } = props;
          const styles = css`
            color: hsl(0, 0%, 50%);
            position: absolute;
            top: 50%;
            -webkit-transform: translateY(-50%);
            -ms-transform: translateY(-50%);
            transform: translateY(-50%);
            box-sizing: border-box;
          `;

          return (
            <div className={styles} {...innerProps}>
              {children}
            </div>
          );
        },
      }}
      styles={{
        ...resetSelectStyles(),
        // @ts-ignore
        input: () => {
          return css`
            height: 100%;
            max-width: 100%;
            > div {
              max-width: 100%;
              height: 100%;
            }
            input {
              height: 100%;
              max-width: 100%;
            }
          `;
        },
      }}
      menuShouldScrollIntoView={false}
      placeholder={placeholder || 'Choose'}
      isSearchable={isSearchable}
      isDisabled={isDisabled}
      isClearable={isClearable}
      menuIsOpen={true}
      autoFocus={autoFocus}
      defaultValue={defaultValue}
      value={selectedValue}
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

      // {...creatableOptions}
    />
    // </div>
  );
}
