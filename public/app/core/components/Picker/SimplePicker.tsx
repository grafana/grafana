import React, { SFC } from 'react';
import Select from 'react-select';
import DescriptionOption from './DescriptionOption';
import ResetStyles from './ResetStyles';

interface Props {
  className?: string;
  defaultValue?: any;
  getOptionLabel: (item: any) => string;
  getOptionValue: (item: any) => string;
  onSelected: (item: any) => {} | void;
  options: any[];
  placeholder?: string;
  width: number;
  value: any;
}

const SimplePicker: SFC<Props> = ({
  className,
  defaultValue,
  getOptionLabel,
  getOptionValue,
  onSelected,
  options,
  placeholder,
  width,
  value,
}) => {
  return (
    <Select
      classNamePrefix={`gf-form-select-box`}
      className={`width-${width} gf-form-input gf-form-input--form-dropdown ${className || ''}`}
      components={{
        Option: DescriptionOption,
      }}
      defaultValue={defaultValue}
      value={value}
      getOptionLabel={getOptionLabel}
      getOptionValue={getOptionValue}
      isSearchable={false}
      onChange={onSelected}
      options={options}
      placeholder={placeholder || 'Choose'}
      styles={ResetStyles}
    />
  );
};

export default SimplePicker;
