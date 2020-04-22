import React, { useCallback } from 'react';
// @ts-ignore
import { default as ReactSelect } from '@torkelo/react-select';
// @ts-ignore
import Creatable from '@torkelo/react-select/creatable';
// @ts-ignore
import { default as ReactAsyncSelect } from '@torkelo/react-select/async';
// @ts-ignore
import { default as AsyncCreatable } from '@torkelo/react-select/async-creatable';

import { Icon } from '../Icon/Icon';
import { css, cx } from 'emotion';
import resetSelectStyles from './resetSelectStyles';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { IndicatorsContainer } from './IndicatorsContainer';
import { ValueContainer } from './ValueContainer';
import { InputControl } from './InputControl';
import { DropdownIndicator } from './DropdownIndicator';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SingleValue } from './SingleValue';
import { MultiValueContainer, MultiValueRemove } from './MultiValue';
import { useTheme } from '../../themes';
import { getSelectStyles } from './getSelectStyles';
import { cleanValue } from './utils';
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
  autoFocus = false,
  backspaceRemovesValue = true,
  closeMenuOnSelect = true,
  components,
  defaultOptions,
  defaultValue,
  disabled = false,
  formatCreateLabel,
  getOptionLabel,
  getOptionValue,
  inputValue,
  invalid,
  isClearable = false,
  isLoading = false,
  isMulti = false,
  isOpen,
  isSearchable = true,
  loadOptions,
  loadingMessage = 'Loading options...',
  maxMenuHeight = 300,
  maxVisibleValues,
  menuPosition,
  menuPlacement = 'auto',
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
  className,
  value,
  width,
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
    [isMulti, value, onChange]
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
    backspaceRemovesValue,
    captureMenuScroll: false,
    closeMenuOnSelect,
    defaultValue,
    // Also passing disabled, as this is the new Select API, and I want to use this prop instead of react-select's one
    disabled,
    getOptionLabel,
    getOptionValue,
    inputValue,
    invalid,
    isClearable,
    // Passing isDisabled as react-select accepts this prop
    isDisabled: disabled,
    isLoading,
    isMulti,
    isSearchable,
    maxMenuHeight,
    maxVisibleValues,
    menuIsOpen: isOpen,
    menuPlacement,
    menuPosition,
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
    value: isMulti ? selectedValue : selectedValue[0],
  };

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
          ValueContainer: (props: any) => {
            const { menuIsOpen } = props.selectProps;
            if (
              Array.isArray(props.children) &&
              Array.isArray(props.children[0]) &&
              maxVisibleValues !== undefined &&
              !(showAllSelectedWhenOpen && menuIsOpen)
            ) {
              const [valueChildren, ...otherChildren] = props.children;
              const truncatedValues = valueChildren.slice(0, maxVisibleValues);

              return <ValueContainer {...props} children={[truncatedValues, ...otherChildren]} />;
            }

            return <ValueContainer {...props} />;
          },
          Placeholder: (props: any) => (
            <div
              {...props.innerProps}
              className={cx(
                css(props.getStyles('placeholder', props)),
                css`
                  display: inline-block;
                  color: ${theme.colors.formInputPlaceholderText};
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
          IndicatorsContainer: (props: any) => {
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
              return <IndicatorsContainer {...props} children={indicatorChildren} />;
            }

            return <IndicatorsContainer {...props} />;
          },
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
            return <Icon className="fa-spin" name="fa fa-spinner" />;
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
            // This puts the menu above Inputs (z-index: 1)
            zIndex: theme.zIndex.dropdown,
            width: width ? `${8 * width}px` : '100%',
          }),
        }}
        className={cx('select-container', className)}
        {...commonSelectProps}
        {...creatableProps}
        {...asyncSelectProps}
      />
    </>
  );
}
