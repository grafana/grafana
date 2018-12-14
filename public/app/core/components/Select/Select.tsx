// Libraries
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { default as ReactSelect } from 'react-select';
import { default as ReactAsyncSelect } from 'react-select/lib/Async';
import { components } from 'react-select';

// Components
import { Option, SingleValue } from './PickerOption';
import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';
import ResetStyles from './ResetStyles';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';

export interface SelectOptionItem {
  label?: string;
  value?: any;
  imgUrl?: string;
  description?: string;
  [key: string]: any;
}

interface CommonProps {
  defaultValue?: any;
  getOptionLabel?: (item: SelectOptionItem) => string;
  getOptionValue?: (item: SelectOptionItem) => string;
  onChange: (item: SelectOptionItem) => {} | void;
  placeholder?: string;
  width?: number;
  value?: SelectOptionItem;
  className?: string;
  components: object;
  isDisabled?: boolean;
  isSearchable?: boolean;
  isClearable?: boolean;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  onBlur?: () => void;
  maxMenuHeight?: number;
  isLoading: boolean;
  noOptionsMessage?: () => string;
  isMulti?: boolean;
  backspaceRemovesValue: boolean;
}

interface SelectProps {
  options: SelectOptionItem[];
}

interface AsyncProps {
  defaultOptions: boolean;
  loadOptions: (query: string) => Promise<SelectOptionItem[]>;
  loadingMessage?: () => string;
}

export const MenuList = props => {
  return (
    <components.MenuList {...props}>
      <CustomScrollbar autoHide={false}>{props.children}</CustomScrollbar>
    </components.MenuList>
  );
};

export class Select extends PureComponent<CommonProps & SelectProps> {
  static defaultProps = {
    width: null,
    className: '',
    components: {},
    isDisabled: false,
    isSearchable: true,
    isClearable: false,
    isMulti: false,
    openMenuOnFocus: false,
    autoFocus: false,
    isLoading: false,
    backspaceRemovesValue: true,
    maxMenuHeight: 300,
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
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);

    return (
      <ReactSelect
        classNamePrefix="gf-form-select-box"
        className={selectClassNames}
        components={{
          Option,
          SingleValue,
          IndicatorsContainer,
          MenuList,
        }}
        defaultValue={defaultValue}
        value={value}
        getOptionLabel={getOptionLabel}
        getOptionValue={getOptionValue}
        menuShouldScrollIntoView={false}
        isSearchable={isSearchable}
        onChange={onChange}
        options={options}
        placeholder={placeholder || 'Choose'}
        styles={ResetStyles}
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
      />
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
    } = this.props;

    let widthClass = '';
    if (width) {
      widthClass = 'width-' + width;
    }

    const selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);

    return (
      <ReactAsyncSelect
        classNamePrefix="gf-form-select-box"
        className={selectClassNames}
        components={{
          Option,
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
        styles={ResetStyles}
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
  }
}

export default Select;
