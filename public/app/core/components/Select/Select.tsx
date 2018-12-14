// Libraries
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { default as ReactSelect } from 'react-select';
import { default as ReactAsyncSelect } from 'react-select/lib/Async';

// Components
import { Option, SingleValue } from './PickerOption';
import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';
import ResetStyles from './ResetStyles';

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
  value?: any;
  className?: string;
  components: object;
  isDisabled?: boolean;
  isSearchable: boolean;
}

interface SelectProps {
  options: SelectOptionItem[];
}

interface AsyncProps {
  defaultOptions: boolean;
  loadOptions: (query: string) => Promise<SelectOptionItem[]>;
  isLoading: boolean;
  loadingMessage?: () => string;
  noOptionsMessage?: () => string;
}

export class Select extends PureComponent<CommonProps & SelectProps> {
  static defaultProps = {
    width: null,
    className: '',
    components: {},
    isDisabled: false,
    isSearchable: true,
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
      isSearchable
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
    isSearchable: true,
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
      />
    );
  }
}

export default Select;
