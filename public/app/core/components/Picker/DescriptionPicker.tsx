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
}

class DescriptionPicker extends Component<Props, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const { optionsWithDesc, onSelected, disabled, className } = this.props;
    return (
      <div className="permissions-picker">
        <Select
          placeholder="Choose"
          classNamePrefix={`gf-form-select2`}
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
          // menuIsOpen={true} // debug
        />
      </div>
    );
  }
}

export default DescriptionPicker;
