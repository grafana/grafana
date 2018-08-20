import React, { Component } from 'react';
import Select from 'react-select';
import DescriptionOption from './DescriptionOption';

export interface Props {
  optionsWithDesc: OptionWithDescription[];
  onSelected: (permission) => void;
  value: number;
  disabled: boolean;
  className?: string;
}

export interface OptionWithDescription {
  value: any;
  label: string;
  description: string;
}

class DescriptionPicker extends Component<Props, any> {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const { optionsWithDesc, onSelected, value, disabled, className } = this.props;

    return (
      <div className="permissions-picker">
        <Select
          value={value}
          valueKey="value"
          multi={false}
          clearable={false}
          labelKey="label"
          options={optionsWithDesc}
          onChange={onSelected}
          className={`width-7 gf-form-input gf-form-input--form-dropdown ${className || ''}`}
          optionComponent={DescriptionOption}
          placeholder="Choose"
          disabled={disabled}
        />
      </div>
    );
  }
}

export default DescriptionPicker;
