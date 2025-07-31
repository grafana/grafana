import { t } from 'i18next';
import { isArray, negate } from 'lodash';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';
import {
  default as ReactSelect,
  IndicatorsContainerProps,
  Props as ReactSelectProps,
  ClearIndicatorProps,
} from 'react-select';
import { default as ReactAsyncSelect } from 'react-select/async';
import { default as AsyncCreatable } from 'react-select/async-creatable';
import Creatable from 'react-select/creatable';

import { SelectableValue, toOption } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

import { CustomInput } from './CustomInput';
import { DropdownIndicator } from './DropdownIndicator';
import { IndicatorsContainer } from './IndicatorsContainer';
import { InputControl } from './InputControl';
import { MultiValueContainer, MultiValueRemove } from './MultiValue';
import { SelectContainer } from './SelectContainer';
import { SelectMenu, SelectMenuOptions, VirtualizedSelectMenu } from './SelectMenu';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SelectOptionGroupHeader } from './SelectOptionGroupHeader';
import { Props, SingleValue } from './SingleValue';
import { ValueContainer } from './ValueContainer';
import { getSelectStyles } from './getSelectStyles';
import { useCustomSelectStyles } from './resetSelectStyles';
import { ActionMeta, InputActionMeta, SelectBaseProps, ToggleAllState } from './types';
import { cleanValue, findSelectedValue, omitDescriptions } from './utils';

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

interface SelectPropsWithExtras extends ReactSelectProps {
  maxVisibleValues?: number | undefined;
  showAllSelectedWhenOpen: boolean;
  noMultiValueWrap?: boolean;
}

function determineToggleAllState(selectedValue: SelectableValue[], options: SelectableValue[]) {
  if (options.length === selectedValue.length) {
    return ToggleAllState.allSelected;
  } else if (selectedValue.length === 0) {
    return ToggleAllState.noneSelected;
  } else {
    return ToggleAllState.indeterminate;
  }
}

export function SelectBase<T, Rest = {}>({
  allowCustomValue = false,
  allowCreateWhileLoading = false,
  'aria-label': ariaLabel,
  'data-testid': dataTestid,
  autoFocus = false,
  backspaceRemovesValue = true,
  blurInputOnSelect,
  cacheOptions,
  className,
  closeMenuOnSelect = true,
  components,
  createOptionPosition = 'last',
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
  noOptionsMessage = t('grafana-ui.select.no-options-label', 'No options found'),
  onBlur,
  onChange,
  onCloseMenu,
  onCreateOption,
  onInputChange,
  onKeyDown,
  onMenuScrollToBottom,
  onMenuScrollToTop,
  onOpenMenu,
  onFocus,
  toggleAllOptions,
  openMenuOnFocus = false,
  options = [],
  placeholder = t('grafana-ui.select.placeholder', 'Choose'),
  prefix,
  renderControl,
  showAllSelectedWhenOpen = true,
  tabSelectsValue = true,
  value,
  virtualized = false,
  noMultiValueWrap,
  width,
  isValidNewOption,
  formatOptionLabel,
  hideSelectedOptions,
  ...rest
}: SelectBaseProps<T> & Rest) {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  const reactSelectRef = useRef<{ controlRef: HTMLElement }>(null);
  const [closeToBottom, setCloseToBottom] = useState<boolean>(false);
  const selectStyles = useCustomSelectStyles(theme, width);
  const [hasInputValue, setHasInputValue] = useState<boolean>(!!inputValue);

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

  const creatableProps: ComponentProps<typeof Creatable<SelectableValue<T>>> = {};
  let asyncSelectProps: any = {};
  let selectedValue;
  if (isMulti && loadOptions) {
    selectedValue = value as any;
  } else {
    // If option is passed as a plain value (value property from SelectableValue property)
    // we are selecting the corresponding value from the options
    if (isMulti && value && Array.isArray(value) && !loadOptions) {
      selectedValue = value.map((v) => {
        // @ts-ignore
        const selectableValue = findSelectedValue(v.value ?? v, options);
        // If the select allows custom values there likely won't be a selectableValue in options
        // so we must return a new selectableValue
        if (selectableValue) {
          return selectableValue;
        }
        return typeof v === 'string' ? toOption(v) : v;
      });
    } else if (loadOptions) {
      const hasValue = defaultValue || value;
      selectedValue = hasValue ? [hasValue] : [];
    } else {
      selectedValue = cleanValue(value, options);
    }
  }

  const commonSelectProps = {
    'aria-label': ariaLabel,
    'data-testid': dataTestid,
    autoFocus,
    backspaceRemovesValue,
    blurInputOnSelect,
    captureMenuScroll: onMenuScrollToBottom || onMenuScrollToTop,
    closeMenuOnSelect,
    // We don't want to close if we're actually scrolling the menu
    // So only close if none of the parents are the select menu itself
    defaultValue,
    // Also passing disabled, as this is the new Select API, and I want to use this prop instead of react-select's one
    disabled,
    // react-select always tries to filter the options even at first menu open, which is a problem for performance
    // in large lists. So we set it to not try to filter the options if there is no input value.
    filterOption: hasInputValue ? filterOption : null,
    getOptionLabel,
    getOptionValue,
    hideSelectedOptions,
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
    onInputChange: (val: string, actionMeta: InputActionMeta) => {
      const newValue = onInputChange?.(val, actionMeta) ?? val;
      const newHasValue = !!newValue;
      if (newHasValue !== hasInputValue) {
        setHasInputValue(newHasValue);
      }

      return newValue;
    },
    onKeyDown,
    onMenuClose: onCloseMenu,
    onMenuOpen: onOpenMenu,
    onMenuScrollToBottom: onMenuScrollToBottom,
    onMenuScrollToTop: onMenuScrollToTop,
    onFocus,
    formatOptionLabel,
    openMenuOnFocus,
    options: virtualized ? omitDescriptions(options) : options,
    placeholder,
    prefix,
    renderControl,
    showAllSelectedWhenOpen,
    tabSelectsValue,
    value: isMulti ? selectedValue : selectedValue?.[0],
    noMultiValueWrap,
  };

  // Auto-select 'all' option when no value is selected and 'all' option exists
  const hasNoValue = isMulti
    ? !selectedValue || (Array.isArray(selectedValue) && selectedValue.length === 0)
    : !selectedValue;

  if (hasNoValue && options.length > 0) {
    const allOption = options.find(
      (option) =>
        option.value === 'all' || option.value === '*' || (option.label && option.label.toLowerCase() === 'all')
    );

    if (allOption) {
      selectedValue = isMulti ? [allOption] : allOption;
      // Update the commonSelectProps to reflect the auto-selected value
      commonSelectProps.value = isMulti ? selectedValue : selectedValue;
    }
  }

  if (allowCustomValue) {
    ReactSelectComponent = Creatable;
    creatableProps.allowCreateWhileLoading = allowCreateWhileLoading;
    creatableProps.formatCreateLabel = formatCreateLabel ?? defaultFormatCreateLabel;
    creatableProps.onCreateOption = onCreateOption;
    creatableProps.createOptionPosition = createOptionPosition;
    creatableProps.isValidNewOption = isValidNewOption;
  }

  // Instead of having AsyncSelect, as a separate component we render ReactAsyncSelect
  if (loadOptions) {
    ReactSelectComponent = allowCustomValue ? AsyncCreatable : ReactAsyncSelect;
    asyncSelectProps = {
      loadOptions,
      cacheOptions,
      defaultOptions,
    };
  }

  const SelectMenuComponent = virtualized ? VirtualizedSelectMenu : SelectMenu;

  let toggleAllState = ToggleAllState.noneSelected;
  if (toggleAllOptions?.enabled && isArray(selectedValue)) {
    if (toggleAllOptions?.determineToggleAllState) {
      toggleAllState = toggleAllOptions.determineToggleAllState(selectedValue, options);
    } else {
      toggleAllState = determineToggleAllState(selectedValue, options);
    }
  }

  const toggleAll = useCallback(() => {
    let toSelect = toggleAllState === ToggleAllState.noneSelected ? options : [];
    if (toggleAllOptions?.optionsFilter) {
      toSelect =
        toggleAllState === ToggleAllState.noneSelected
          ? options.filter(toggleAllOptions.optionsFilter)
          : options.filter(negate(toggleAllOptions.optionsFilter));
    }

    onChange(toSelect, {
      action: 'select-option',
      option: {},
    });
  }, [options, toggleAllOptions, onChange, toggleAllState]);

  return (
    <>
      <ReactSelectComponent
        ref={reactSelectRef}
        components={{
          MenuList: SelectMenuComponent,
          Group: SelectOptionGroup,
          GroupHeading: SelectOptionGroupHeader,
          ValueContainer,
          IndicatorsContainer: CustomIndicatorsContainer,
          IndicatorSeparator: IndicatorSeparator,
          Control: CustomControl,
          Option: SelectMenuOptions,
          ClearIndicator(props: ClearIndicatorProps) {
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
          DropdownIndicator: DropdownIndicator,
          SingleValue(props: Props<T>) {
            return <SingleValue {...props} isDisabled={disabled} />;
          },
          SelectContainer,
          MultiValueContainer: MultiValueContainer,
          MultiValueRemove: !disabled ? MultiValueRemove : () => null,
          Input: CustomInput,
          ...components,
        }}
        toggleAllOptions={
          toggleAllOptions?.enabled && {
            state: toggleAllState,
            selectAllClicked: toggleAll,
            selectedCount: isArray(selectedValue) ? selectedValue.length : undefined,
          }
        }
        styles={selectStyles}
        className={className}
        {...commonSelectProps}
        {...creatableProps}
        {...asyncSelectProps}
        {...rest}
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

type CustomIndicatorsContainerProps = IndicatorsContainerProps & {
  selectProps: SelectPropsWithExtras;
  children: React.ReactNode;
};

function CustomIndicatorsContainer(props: CustomIndicatorsContainerProps) {
  const { showAllSelectedWhenOpen, maxVisibleValues, menuIsOpen } = props.selectProps;

  const value = props.getValue();

  if (maxVisibleValues !== undefined && Array.isArray(props.children)) {
    const selectedValuesCount = value.length;

    if (selectedValuesCount > maxVisibleValues && !(showAllSelectedWhenOpen && menuIsOpen)) {
      const indicatorChildren = [...props.children];
      indicatorChildren.splice(
        -1,
        0,
        <span key="excess-values" id="excess-values">
          (+{selectedValuesCount - maxVisibleValues})
        </span>
      );

      return <IndicatorsContainer {...props}>{indicatorChildren}</IndicatorsContainer>;
    }
  }

  return <IndicatorsContainer {...props} />;
}

function IndicatorSeparator() {
  return <></>;
}
