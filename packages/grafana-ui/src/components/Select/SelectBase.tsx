import React, { ComponentProps, useCallback } from 'react';
import { default as ReactSelect } from 'react-select';
import Creatable from 'react-select/creatable';
import { default as ReactAsyncSelect } from 'react-select/async';
import { default as AsyncCreatable } from 'react-select/async-creatable';

import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import { css, cx } from '@emotion/css';
import resetSelectStyles from './resetSelectStyles';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { IndicatorsContainer } from './IndicatorsContainer';
import { ValueContainer } from './ValueContainer';
import { InputControl } from './InputControl';
import { DropdownIndicator } from './DropdownIndicator';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SingleValue } from './SingleValue';
import { MultiValueContainer, MultiValueRemove } from './MultiValue';
import { useTheme2 } from '../../themes';
import { getSelectStyles } from './getSelectStyles';
import { cleanValue, findSelectedValue } from './utils';
import { SelectBaseProps, SelectValue } from './types';

interface ExtraValuesIndicatorProps {
  maxVisibleValues?: number | undefined;
  selectedValuesCount: number;
  menuIsOpen: boolean;
  showAllSelectedWhenOpen: boolean;
}

const renderExtraValuesIndicator = (props: ExtraValuesIndicatorProps) => {
  const { maxVisibleValues, selectedValuesCount, menuIsOpen, showAllSelectedWhenOpen } = props;

  if (
    maxVisibleValues !== undefined &&
    selectedValuesCount > maxVisibleValues &&
    !(showAllSelectedWhenOpen && menuIsOpen)
  ) {
    return (
      <span key="excess-values" id="excess-values">
        (+{selectedValuesCount - maxVisibleValues})
      </span>
    );
  }

  return null;
};

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
  allowCustomValue = false,
  'aria-label': ariaLabel,
  autoFocus = false,
  backspaceRemovesValue = true,
  cacheOptions,
  className,
  closeMenuOnSelect = true,
  components,
  defaultOptions,
  defaultValue,
  disabled = false,
  filterOption,
  formatCreateLabel,
  getOptionLabel,
  getOptionValue,
  inputValue,
  invalid,
  isClearable = false,
  id,
  isLoading = false,
  isMulti = false,
  inputId,
  isOpen,
  isOptionDisabled,
  isSearchable = true,
  loadOptions,
  loadingMessage = 'Loading options...',
  maxMenuHeight = 300,
  minMenuHeight,
  maxVisibleValues,
  menuPlacement = 'auto',
  menuPosition,
  noOptionsMessage = 'No options found',
  onBlur,
  onChange,
  onCloseMenu,
  onCreateOption,
  onInputChange,
  onKeyDown,
  onOpenMenu,
  openMenuOnFocus = false,
  options = [],
  placeholder = 'Choose',
  prefix,
  renderControl,
  showAllSelectedWhenOpen = true,
  tabSelectsValue = true,
  value,
  width,
  isValidNewOption,
}: SelectBaseProps<T>) {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const onChangeWithEmpty = useCallback(
    (value: SelectValue<T>) => {
      if (isMulti && (value === undefined || value === null)) {
        return onChange([]);
      }
      onChange(value);
    },
    [isMulti, onChange]
  );

  let ReactSelectComponent = ReactSelect;

  const creatableProps: ComponentProps<typeof Creatable> = {};
  let asyncSelectProps: any = {};
  let selectedValue;
  if (isMulti && loadOptions) {
    selectedValue = value as any;
  } else {
    // If option is passed as a plain value (value property from SelectableValue property)
    // we are selecting the corresponding value from the options
    if (isMulti && value && Array.isArray(value) && !loadOptions) {
      // @ts-ignore
      selectedValue = value.map((v) => findSelectedValue(v.value ?? v, options));
    } else if (loadOptions) {
      const hasValue = defaultValue || value;
      selectedValue = hasValue ? [hasValue] : [];
    } else {
      selectedValue = cleanValue(value, options);
    }
  }

  const commonSelectProps = {
    'aria-label': ariaLabel,
    autoFocus,
    backspaceRemovesValue,
    captureMenuScroll: false,
    closeMenuOnSelect,
    // We don't want to close if we're actually scrolling the menu
    // So only close if none of the parents are the select menu itself
    defaultValue,
    // Also passing disabled, as this is the new Select API, and I want to use this prop instead of react-select's one
    disabled,
    filterOption,
    getOptionLabel,
    getOptionValue,
    inputValue,
    invalid,
    isClearable,
    id,
    // Passing isDisabled as react-select accepts this prop
    isDisabled: disabled,
    isLoading,
    isMulti,
    inputId,
    isOptionDisabled,
    isSearchable,
    maxMenuHeight,
    minMenuHeight,
    maxVisibleValues,
    menuIsOpen: isOpen,
    menuPlacement,
    menuPortalTarget: document.body,
    menuPosition,
    menuShouldBlockScroll: true,
    menuShouldScrollIntoView: false,
    onBlur,
    onChange: onChangeWithEmpty,
    onInputChange,
    onKeyDown,
    onMenuClose: onCloseMenu,
    onMenuOpen: onOpenMenu,
    openMenuOnFocus,
    options,
    placeholder,
    prefix,
    renderControl,
    showAllSelectedWhenOpen,
    tabSelectsValue,
    value: isMulti ? selectedValue : selectedValue?.[0],
  };

  if (allowCustomValue) {
    ReactSelectComponent = Creatable as any;
    creatableProps.formatCreateLabel = formatCreateLabel ?? ((input: string) => `Create: ${input}`);
    creatableProps.onCreateOption = onCreateOption;
    creatableProps.isValidNewOption = isValidNewOption;
  }

  // Instead of having AsyncSelect, as a separate component we render ReactAsyncSelect
  if (loadOptions) {
    ReactSelectComponent = (allowCustomValue ? AsyncCreatable : ReactAsyncSelect) as any;
    asyncSelectProps = {
      loadOptions,
      cacheOptions,
      defaultOptions,
    };
  }

  return (
    <>
      <ReactSelectComponent
        components={{
          MenuList: SelectMenu,
          Group: SelectOptionGroup,
          ValueContainer,
          Placeholder(props: any) {
            return (
              <div
                {...props.innerProps}
                className={cx(
                  css(props.getStyles('placeholder', props)),
                  css`
                    display: inline-block;
                    color: ${theme.colors.text.disabled};
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    box-sizing: border-box;
                    line-height: 1;
                    white-space: nowrap;
                  `
                )}
              >
                {props.children}
              </div>
            );
          },
          IndicatorsContainer(props: any) {
            const { selectProps } = props;
            const { value, showAllSelectedWhenOpen, maxVisibleValues, menuIsOpen } = selectProps;

            if (maxVisibleValues !== undefined) {
              const selectedValuesCount = value.length;
              const indicatorChildren = [...props.children];
              indicatorChildren.splice(
                -1,
                0,
                renderExtraValuesIndicator({
                  maxVisibleValues,
                  selectedValuesCount,
                  showAllSelectedWhenOpen,
                  menuIsOpen,
                })
              );
              return <IndicatorsContainer {...props}>{indicatorChildren}</IndicatorsContainer>;
            }

            return <IndicatorsContainer {...props} />;
          },
          IndicatorSeparator() {
            return <></>;
          },
          Control: CustomControl,
          Option: SelectMenuOptions,
          ClearIndicator(props: any) {
            const { clearValue } = props;
            return (
              <Icon
                name="times"
                role="button"
                aria-label="select-clear-value"
                className={styles.singleValueRemove}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearValue();
                }}
              />
            );
          },
          LoadingIndicator(props: any) {
            return <Spinner inline={true} />;
          },
          LoadingMessage(props: any) {
            return <div className={styles.loadingMessage}>{loadingMessage}</div>;
          },
          NoOptionsMessage(props: any) {
            return (
              <div className={styles.loadingMessage} aria-label="No options provided">
                {noOptionsMessage}
              </div>
            );
          },
          DropdownIndicator(props: any) {
            return <DropdownIndicator isOpen={props.selectProps.menuIsOpen} />;
          },
          SingleValue(props: any) {
            return <SingleValue {...props} disabled={disabled} />;
          },
          MultiValueContainer: MultiValueContainer,
          MultiValueRemove: MultiValueRemove,
          ...components,
        }}
        styles={{
          ...resetSelectStyles(),
          menuPortal: (base: any) => ({
            ...base,
            zIndex: theme.zIndex.portal,
          }),
          //These are required for the menu positioning to function
          menu: ({ top, bottom, position }: any) => ({
            top,
            bottom,
            position,
            minWidth: '100%',
          }),
          container: () => ({
            position: 'relative',
            width: width ? `${8 * width}px` : '100%',
          }),
          option: (provided: any, state: any) => ({
            ...provided,
            opacity: state.isDisabled ? 0.5 : 1,
          }),
        }}
        className={className}
        {...commonSelectProps}
        {...creatableProps}
        {...asyncSelectProps}
      />
    </>
  );
}
