import React, { useCallback } from 'react';
import { deprecationWarning } from '@grafana/data';
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
import { inputSizesPixels } from '../commonStyles';
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
import { cleanValue } from './utils';
import { SelectBaseProps, SelectValue } from './types';

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
  menuPosition,
}: SelectBaseProps<T>) {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const onChangeWithEmpty = useCallback(
    (value: SelectValue<T>) => {
      if (isMulti && (value === undefined || value === null)) {
        return onChange([]);
      }
      onChange(value);
    },
    [isMulti]
  );
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
    } else if (loadOptions) {
      const hasValue = defaultValue || value;
      selectedValue = hasValue ? [hasValue] : [];
    } else {
      selectedValue = cleanValue(value, options);
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
    onChange: onChangeWithEmpty,
    onBlur,
    onKeyDown,
    menuShouldScrollIntoView: false,
    renderControl,
    captureMenuScroll: false,
    menuPlacement: 'auto',
    menuPosition,
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
    <>
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
          //These are required for the menu positioning to function
          menu: ({ top, bottom, width, position }: any) => ({
            top,
            bottom,
            width,
            position,
            marginBottom: !!bottom ? '10px' : '0',
            zIndex: 9999,
          }),
          container: () => ({
            position: 'relative',
            width: inputSizesPixels(size),
          }),
        }}
        className={widthClass}
        {...commonSelectProps}
        {...creatableProps}
        {...asyncSelectProps}
      />
    </>
  );
}
