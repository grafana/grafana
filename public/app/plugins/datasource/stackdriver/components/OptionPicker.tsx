import React from 'react';
// import SimplePicker from 'app/core/components/Picker/SimplePicker';
import Select from 'react-select';
// import DescriptionPicker from 'app/core/components/Picker/DescriptionPicker';
import DescriptionOption from 'app/core/components/Picker/DescriptionOption';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import NoOptionsMessage from 'app/core/components/Picker/NoOptionsMessage';
import _ from 'lodash';

export interface Props {
  onChange: (value: string) => void;
  options: any[];
  selected: string;
  placeholder?: string;
  className?: string;
}

export class OptionPicker extends React.Component<Props, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const { onChange, options, selected, placeholder, className } = this.props;
    const selectedOption = options.find(metric => metric.value === selected);
    return (
      <Select
        placeholder={placeholder}
        classNamePrefix={`gf-form-select-box`}
        className={className}
        options={options}
        components={{
          Option: DescriptionOption,
          IndicatorsContainer,
          NoOptionsMessage,
        }}
        styles={ResetStyles}
        isDisabled={false}
        onChange={option => onChange(option.value)}
        getOptionValue={i => i.value}
        getOptionLabel={i => i.label}
        value={selectedOption}
        noOptionsMessage={() => 'No metrics found'}
      />
    );
  }
}
