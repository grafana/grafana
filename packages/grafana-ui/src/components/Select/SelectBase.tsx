import React, { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import { default as ReactSelect } from 'react-select';
import { default as ReactAsyncSelect } from 'react-select/async';
import { default as AsyncCreatable } from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';

import { SelectableValue } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

import { DropdownIndicator } from './DropdownIndicator';
import { IndicatorsContainer } from './IndicatorsContainer';
import { InputControl } from './InputControl';
import { MultiValueContainer, MultiValueRemove } from './MultiValue';
import { SelectContainer } from './SelectContainer';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SingleValue } from './SingleValue';
import { ValueContainer } from './ValueContainer';
import { getSelectStyles } from './getSelectStyles';
import { useCustomSelectStyles } from './resetSelectStyles';
import { ActionMeta, SelectBaseProps } from './types';
import { cleanValue, findSelectedValue } from './utils';

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
  allowCreateWhileLoading = false,
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
  menuShouldPortal = true,
  noOptionsMessage = 'No options found',
  onBlur,
  onChange,
  onCloseMenu,
  onCreateOption,
  onInputChange,
  onKeyDown,
  onOpenMenu,
  onFocus,
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
  formatOptionLabel,
}: SelectBaseProps<T>) {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  const reactSelectRef = useRef<{ controlRef: HTMLElement }>(null);
  const [closeToBottom, setCloseToBottom] = useState<boolean>(false);
  const selectStyles = useCustomSelectStyles(theme, width);

  // Infer the menu position for asynchronously loaded options. menuPlacement="auto" doesn't work when the menu is
  // automatically opened when the component is created (it happens in SegmentSelect by setting menuIsOpen={true}).
  // We can remove this workaround when the bug in react-select is fixed: https://github.com/JedWatson/react-select/issues/4936
  // Note: we use useEffect instead of hooking into onMenuOpen due to another bug: https://github.com/JedWatson/react-select/issues/3375
  useEffect(() => {
    if (
      loadOptions &&
      isOpen &&
      reactSelectRef.current &&
      reactSelectRef.current.controlRef &&
      menuPlacement === 'auto'
    ) {
      const distance = window.innerHeight - reactSelectRef.current.controlRef.getBoundingClientRect().bottom;
      setCloseToBottom(distance < maxMenuHeight);
    }
  }, [maxMenuHeight, menuPlacement, loadOptions, isOpen]);

  const onChangeWithEmpty = useCallback(
    (value: SelectableValue<T>, action: ActionMeta) => {
      if (isMulti && (value === undefined || value === null)) {
        return onChange([], action);
      }
      onChange(value, action);
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
    menuPlacement: menuPlacement === 'auto' && closeToBottom ? 'top' : menuPlacement,
    menuPosition,
    menuShouldBlockScroll: true,
    menuPortalTarget: menuShouldPortal && typeof document !== 'undefined' ? document.body : undefined,
    menuShouldScrollIntoView: false,
    onBlur,
    onChange: onChangeWithEmpty,
    onInputChange,
    onKeyDown,
    onMenuClose: onCloseMenu,
    onMenuOpen: onOpenMenu,
    onFocus,
    formatOptionLabel,
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
    creatableProps.allowCreateWhileLoading = allowCreateWhileLoading;
    creatableProps.formatCreateLabel = formatCreateLabel ?? defaultFormatCreateLabel;
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
        ref={reactSelectRef}
        components={{
          MenuList: SelectMenu,
          Group: SelectOptionGroup,
          ValueContainer,
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
          LoadingIndicator() {
            return <Spinner inline />;
          },
          LoadingMessage() {
            return <div className={styles.loadingMessage}>{loadingMessage}</div>;
          },
          NoOptionsMessage() {
            return (
              <div className={styles.loadingMessage} aria-label="No options provided">
                {noOptionsMessage}
              </div>
            );
          },
          DropdownIndicator(props) {
            return <DropdownIndicator isOpen={props.selectProps.menuIsOpen} />;
          },
          SingleValue(props: any) {
            return <SingleValue {...props} disabled={disabled} />;
          },
          SelectContainer,
          MultiValueContainer: MultiValueContainer,
          MultiValueRemove: MultiValueRemove,
          ...components,
        }}
        styles={selectStyles}
        className={className}
        {...commonSelectProps}
        {...creatableProps}
        {...asyncSelectProps}
      />
    </>
  );
}

function defaultFormatCreateLabel(input: string) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div>{input}</div>
      <div style={{ flexGrow: 1 }} />
      <div className="muted small" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        Hit enter to add
      </div>
    </div>
  );
}
