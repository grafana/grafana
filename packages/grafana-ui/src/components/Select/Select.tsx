// Libraries
import classNames from 'classnames';
import React, { PureComponent } from 'react';

// Ignoring because I couldn't get @types/react-select work wih Torkel's fork
// @ts-ignore
import { default as ReactSelect } from '@torkelo/react-select';
// @ts-ignore
import { default as ReactAsyncSelect } from '@torkelo/react-select/lib/Async';
// @ts-ignore
import { components } from '@torkelo/react-select';

// Components
import { SelectOption, SingleValue } from './SelectOption';
import SelectOptionGroup from './SelectOptionGroup';
import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';
import resetSelectStyles from './resetSelectStyles';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { PopperContent } from '@grafana/ui/src/components/Tooltip/PopperController';
import { Tooltip } from '@grafana/ui';

export interface SelectOptionItem {
  label?: string;
  value?: any;
  imgUrl?: string;
  description?: string;
  [key: string]: any;
}

export interface CommonProps {
  defaultValue?: any;
  getOptionLabel?: (item: SelectOptionItem) => string;
  getOptionValue?: (item: SelectOptionItem) => string;
  onChange: (item: SelectOptionItem) => {} | void;
  placeholder?: string;
  width?: number;
  value?: SelectOptionItem;
  className?: string;
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
  tooltipContent?: PopperContent<any>;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
}

export interface SelectProps {
  options: SelectOptionItem[];
}

interface AsyncProps {
  defaultOptions: boolean;
  loadOptions: (query: string) => Promise<SelectOptionItem[]>;
  loadingMessage?: () => string;
}

const wrapInTooltip = (
  component: React.ReactElement,
  tooltipContent: PopperContent<any> | undefined,
  isMenuOpen: boolean | undefined
) => {
  const showTooltip = isMenuOpen ? false : undefined;
  if (tooltipContent) {
    return (
      <Tooltip show={showTooltip} content={tooltipContent} placement="bottom">
        <div>
          {/* div needed for tooltip */}
          {component}
        </div>
      </Tooltip>
    );
  } else {
    return <div>{component}</div>;
  }
};

export const MenuList = (props: any) => {
  return (
    <components.MenuList {...props}>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit">
        {props.children}
      </CustomScrollbar>
    </components.MenuList>
  );
};

export class Select extends PureComponent<CommonProps & SelectProps> {
  static defaultProps = {
    width: null,
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
    menuIsOpen: false,
    components: {
      Option: SelectOption,
      SingleValue,
      IndicatorsContainer,
      MenuList,
      Group: SelectOptionGroup,
    },
  };

  onOpenMenu = () => {
    const { onOpenMenu } = this.props;
    if (onOpenMenu) {
      onOpenMenu();
    }
  };

  onCloseMenu = () => {
    const { onCloseMenu } = this.props;
    if (onCloseMenu) {
      onCloseMenu();
    }
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
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);
    const selectComponents = { ...Select.defaultProps.components, ...components };
    return wrapInTooltip(
      <ReactSelect
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
        styles={resetSelectStyles()}
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
        onMenuOpen={this.onOpenMenu}
        onMenuClose={this.onCloseMenu}
      />,
      tooltipContent,
      isOpen
    );
  }
}

export class AsyncSelect extends PureComponent<CommonProps & AsyncProps> {
  static defaultProps = {
    width: null,
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
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);

    return wrapInTooltip(
      <ReactAsyncSelect
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
        getOptionLabel={getOptionLabel}
        getOptionValue={getOptionValue}
        menuShouldScrollIntoView={false}
        onChange={onChange}
        loadOptions={loadOptions}
        isLoading={isLoading}
        defaultOptions={defaultOptions}
        placeholder={placeholder || 'Choose'}
        styles={resetSelectStyles()}
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
      />,
      tooltipContent,
      false
    );
  }
}

export default Select;
