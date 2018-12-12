import React from 'react';
import Select from 'react-select';
import _ from 'lodash';

import DescriptionOption from 'app/core/components/Picker/DescriptionOption';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import ResetStyles from 'app/core/components/Picker/ResetStyles';
import NoOptionsMessage from 'app/core/components/Picker/NoOptionsMessage';

export interface Props {
  onChange: (value: string) => void;
  options: any[];
  searchable: boolean;
  selected: string;
  placeholder?: string;
  className?: string;
  groups?: boolean;
}

export class OptionPicker extends React.Component<Props, any> {
  constructor(props) {
    super(props);
  }

  render() {
    const { onChange, options, selected, placeholder, className, searchable } = this.props;
    const selectedOption = options.find(option => option.value === selected);

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
        isSearchable={searchable}
        onChange={option => onChange(option.value)}
        getOptionValue={i => i.value}
        getOptionLabel={i => i.label}
        value={selectedOption}
        noOptionsMessage={() => 'No metrics found'}
      />
    );
  }
}
