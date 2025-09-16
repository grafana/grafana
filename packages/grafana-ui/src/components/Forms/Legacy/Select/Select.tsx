// Libraries
import classNames from 'classnames';
import { PureComponent } from 'react';
import * as React from 'react';
import { default as ReactSelect, components, MenuListProps } from 'react-select';
import { default as ReactAsyncSelect } from 'react-select/async';
import Creatable from 'react-select/creatable';

// Components
import { SelectableValue, ThemeContext } from '@grafana/data';

import { ScrollContainer } from '../../../ScrollContainer/ScrollContainer';
import { SingleValue } from '../../../Select/SingleValue';
import resetSelectStyles from '../../../Select/resetSelectStyles';
import { SelectCommonProps, SelectAsyncProps } from '../../../Select/types';
import { Tooltip } from '../../../Tooltip/Tooltip';
import { PopoverContent } from '../../../Tooltip/types';

import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';
import { SelectOption } from './SelectOption';
import { SelectOptionGroup } from './SelectOptionGroup';

/**
 * Changes in new selects:
 * - noOptionsMessage & loadingMessage is of string type
 * - isDisabled is renamed to disabled
 */
type LegacyCommonProps<T> = Omit<SelectCommonProps<T>, 'noOptionsMessage' | 'disabled' | 'value' | 'loadingMessage'>;

interface AsyncProps<T> extends LegacyCommonProps<T>, Omit<SelectAsyncProps<T>, 'loadingMessage'> {
  loadingMessage?: () => string;
  noOptionsMessage?: () => string;
  tooltipContent?: PopoverContent;
  isDisabled?: boolean;
  value?: SelectableValue<T>;
}

export interface LegacySelectProps<T> extends LegacyCommonProps<T> {
  tooltipContent?: PopoverContent;
  noOptionsMessage?: () => string;
  isDisabled?: boolean;
  value?: SelectableValue<T>;
}

export const MenuList = (props: MenuListProps) => {
  return (
    <components.MenuList {...props}>
      <ScrollContainer showScrollIndicators overflowX="hidden" maxHeight="inherit">
        {props.children}
      </ScrollContainer>
    </components.MenuList>
  );
};

/** @deprecated Please use the `Select` component, as seen {@link https://developers.grafana.com/ui/latest/index.html?path=/story/forms-select--basic in Storybook}. */
export class Select<T> extends PureComponent<LegacySelectProps<T>> {
  declare context: React.ContextType<typeof ThemeContext>;
  static contextType = ThemeContext;

  static defaultProps: Partial<LegacySelectProps<unknown>> = {
    className: '',
    isDisabled: false,
    isSearchable: true,
    isClearable: false,
    isMulti: false,
    openMenuOnFocus: false,
    autoFocus: false,
    isLoading: false,
    backspaceRemovesValue: true,
    maxMenuHeight: 300,
    tabSelectsValue: true,
    allowCustomValue: false,
    components: {
      Option: SelectOption,
      SingleValue,
      IndicatorsContainer,
      MenuList,
      Group: SelectOptionGroup,
    },
  };

  render() {
    const {
      defaultValue,
      getOptionLabel,
      getOptionValue,
      onChange,
      options,
      placeholder,
      width,
      value,
      className,
      isDisabled,
      isLoading,
      isSearchable,
      isClearable,
      backspaceRemovesValue,
      isMulti,
      autoFocus,
      openMenuOnFocus,
      onBlur,
      maxMenuHeight,
      noOptionsMessage,
      isOpen,
      components,
      tooltipContent,
      tabSelectsValue,
      onCloseMenu,
      onOpenMenu,
      allowCustomValue,
      formatCreateLabel,
      'aria-label': ariaLabel,
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    let SelectComponent = ReactSelect;
    const creatableOptions: any = {};

    if (allowCustomValue) {
      SelectComponent = Creatable;
      creatableOptions.formatCreateLabel = formatCreateLabel ?? ((input: string) => input);
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);
    const selectComponents = { ...Select.defaultProps.components, ...components };
    return (
      <WrapInTooltip onCloseMenu={onCloseMenu} onOpenMenu={onOpenMenu} tooltipContent={tooltipContent} isOpen={isOpen}>
        {(onOpenMenuInternal, onCloseMenuInternal) => {
          return (
            <SelectComponent
              captureMenuScroll={false}
              classNamePrefix="gf-form-select-box"
              className={selectClassNames}
              components={selectComponents}
              defaultValue={defaultValue}
              value={value}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              menuShouldScrollIntoView={false}
              isSearchable={isSearchable}
              onChange={onChange}
              options={options}
              placeholder={placeholder || 'Choose'}
              styles={resetSelectStyles(this.context)}
              isDisabled={isDisabled}
              isLoading={isLoading}
              isClearable={isClearable}
              autoFocus={autoFocus}
              onBlur={onBlur}
              openMenuOnFocus={openMenuOnFocus}
              maxMenuHeight={maxMenuHeight}
              noOptionsMessage={noOptionsMessage}
              isMulti={isMulti}
              backspaceRemovesValue={backspaceRemovesValue}
              menuIsOpen={isOpen}
              onMenuOpen={onOpenMenuInternal}
              onMenuClose={onCloseMenuInternal}
              tabSelectsValue={tabSelectsValue}
              aria-label={ariaLabel}
              {...creatableOptions}
            />
          );
        }}
      </WrapInTooltip>
    );
  }
}

/** @deprecated Please use the `Select` component with async functionality, as seen {@link https://developers.grafana.com/ui/latest/index.html?path=/story/forms-select--basic-select-async in Storybook}. */
export class AsyncSelect<T> extends PureComponent<AsyncProps<T>> {
  static contextType = ThemeContext;

  static defaultProps: Partial<AsyncProps<unknown>> = {
    className: '',
    components: {},
    loadingMessage: () => 'Loading...',
    isDisabled: false,
    isClearable: false,
    isMulti: false,
    isSearchable: true,
    backspaceRemovesValue: true,
    autoFocus: false,
    openMenuOnFocus: false,
    maxMenuHeight: 300,
  };

  render() {
    const {
      defaultValue,
      getOptionLabel,
      getOptionValue,
      onChange,
      placeholder,
      width,
      value,
      className,
      loadOptions,
      defaultOptions,
      isLoading,
      loadingMessage,
      noOptionsMessage,
      isDisabled,
      isSearchable,
      isClearable,
      backspaceRemovesValue,
      autoFocus,
      onBlur,
      openMenuOnFocus,
      maxMenuHeight,
      isMulti,
      tooltipContent,
      onCloseMenu,
      onOpenMenu,
      isOpen,
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);

    return (
      <WrapInTooltip onCloseMenu={onCloseMenu} onOpenMenu={onOpenMenu} tooltipContent={tooltipContent} isOpen={isOpen}>
        {(onOpenMenuInternal, onCloseMenuInternal) => {
          return (
            <ReactAsyncSelect
              captureMenuScroll={false}
              classNamePrefix="gf-form-select-box"
              className={selectClassNames}
              components={{
                Option: SelectOption,
                SingleValue,
                IndicatorsContainer,
                NoOptionsMessage,
              }}
              defaultValue={defaultValue}
              value={value}
              //@ts-expect-error
              getOptionLabel={getOptionLabel}
              //@ts-expect-error
              getOptionValue={getOptionValue}
              menuShouldScrollIntoView={false}
              //@ts-expect-error
              onChange={onChange}
              loadOptions={loadOptions}
              isLoading={isLoading}
              defaultOptions={defaultOptions}
              placeholder={placeholder || 'Choose'}
              //@ts-expect-error
              styles={resetSelectStyles(this.context)}
              loadingMessage={loadingMessage}
              noOptionsMessage={noOptionsMessage}
              isDisabled={isDisabled}
              isSearchable={isSearchable}
              isClearable={isClearable}
              autoFocus={autoFocus}
              onBlur={onBlur}
              openMenuOnFocus={openMenuOnFocus}
              maxMenuHeight={maxMenuHeight}
              isMulti={isMulti}
              backspaceRemovesValue={backspaceRemovesValue}
            />
          );
        }}
      </WrapInTooltip>
    );
  }
}

export interface TooltipWrapperProps {
  children: (onOpenMenu: () => void, onCloseMenu: () => void) => React.ReactNode;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  isOpen?: boolean;
  tooltipContent?: PopoverContent;
}

export interface TooltipWrapperState {
  isOpenInternal: boolean;
}

export class WrapInTooltip extends PureComponent<TooltipWrapperProps, TooltipWrapperState> {
  state: TooltipWrapperState = {
    isOpenInternal: false,
  };

  onOpenMenu = () => {
    const { onOpenMenu } = this.props;
    if (onOpenMenu) {
      onOpenMenu();
    }
    this.setState({ isOpenInternal: true });
  };

  onCloseMenu = () => {
    const { onCloseMenu } = this.props;
    if (onCloseMenu) {
      onCloseMenu();
    }
    this.setState({ isOpenInternal: false });
  };

  render() {
    const { children, isOpen, tooltipContent } = this.props;
    const { isOpenInternal } = this.state;

    let showTooltip: boolean | undefined = undefined;

    if (isOpenInternal || isOpen) {
      showTooltip = false;
    }

    if (tooltipContent) {
      return (
        <Tooltip show={showTooltip} content={tooltipContent} placement="bottom">
          <div>
            {/* div needed for tooltip */}
            {children(this.onOpenMenu, this.onCloseMenu)}
          </div>
        </Tooltip>
      );
    } else {
      return <div>{children(this.onOpenMenu, this.onCloseMenu)}</div>;
    }
  }
}

export default Select;
