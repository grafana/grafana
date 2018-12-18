import React from 'react';
import _ from 'lodash';
import Select from 'app/core/components/Select/Select';

export interface Props {
  onChange: (value: string) => void;
  options: any[];
  searchable: boolean;
  selected: string;
  placeholder?: string;
  className?: string;
  groups?: boolean;
}

export class StackdriverPicker extends React.Component<Props, any> {
  constructor(props) {
    super(props);
  }

  extractOptions(options) {
    return options.length > 0 && options.every(o => o.options) ? _.flatten(options.map(o => o.options)) : options;
  }

  onChange = item => {
    const extractedOptions = this.extractOptions(this.props.options);
    const option = extractedOptions.find(option => option.value === item.value);
    this.props.onChange(option.value);
  };

  render() {
    const { options, selected, placeholder, className, searchable } = this.props;
    const extractedOptions = this.extractOptions(options);
    const selectedOption = extractedOptions.find(option => option.value === selected);

    return (
      <Select
        className={className}
        isMulti={false}
        isClearable={false}
        backspaceRemovesValue={false}
        onChange={this.onChange}
        options={options}
        autoFocus={false}
        isSearchable={searchable}
        openMenuOnFocus={true}
        maxMenuHeight={500}
        placeholder={placeholder}
        noOptionsMessage={() => 'No options found'}
        value={selectedOption}
      />
    );
  }
}
