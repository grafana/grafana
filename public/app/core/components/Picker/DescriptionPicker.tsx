import React, { Component } from 'react';
import Select from 'react-select';
import DescriptionOption from './DescriptionOption';
import IndicatorsContainer from './IndicatorsContainer';
import ResetStyles from './ResetStyles';
import NoOptionsMessage from './NoOptionsMessage';

export interface OptionWithDescription {
  value: any;
  label: string;
  description: string;
}

export interface Props {
  optionsWithDesc: OptionWithDescription[];
  onSelected: (permission) => void;
  disabled: boolean;
  className?: string;
  value?: any;
}

const getSelectedOption = (optionsWithDesc, value) => optionsWithDesc.find(option => option.value === value);

class DescriptionPicker extends Component<Props, any> {
  render() {
    const { optionsWithDesc, onSelected, disabled, className, value } = this.props;
    const selectedOption = getSelectedOption(optionsWithDesc, value);
    return (
      <div className="permissions-picker">
        <Select
          placeholder="Choose"
          classNamePrefix={`gf-form-select-box`}
          className={`width-7 gf-form-input gf-form-input--form-dropdown ${className || ''}`}
          options={optionsWithDesc}
          components={{
            Option: DescriptionOption,
            IndicatorsContainer,
            NoOptionsMessage,
          }}
          styles={ResetStyles}
          isDisabled={disabled}
          onChange={onSelected}
          getOptionValue={i => i.value}
          getOptionLabel={i => i.label}
          value={selectedOption}
        />
      </div>
    );
  }
}

export default DescriptionPicker;
