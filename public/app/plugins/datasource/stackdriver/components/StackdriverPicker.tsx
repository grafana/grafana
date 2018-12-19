import React from 'react';
import _ from 'lodash';

import Select from 'app/core/components/Select/Select';
import { Variable } from 'app/types/templates';

export interface Props {
  onChange: (value: string) => void;
  options: any[];
  isSearchable: boolean;
  value: string;
  placeholder?: string;
  className?: string;
  groupName?: string;
  variables?: Variable[];
}

interface State {
  options: any[];
}

export class StackdriverPicker extends React.Component<Props, State> {
  static defaultProps = {
    variables: [],
    options: [],
    groupName: 'Options',
  };

  constructor(props) {
    super(props);
    this.state = { options: [] };
  }

  componentDidMount() {
    this.setState({ options: this.buildOptions(this.props) });
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.options.length > 0 || nextProps.variables.length) {
      this.setState({ options: this.buildOptions(nextProps) });
    }
  }

  shouldComponentUpdate(nextProps: Props) {
    const nextOptions = this.buildOptions(nextProps);
    return nextProps.value !== this.props.value || !_.isEqual(nextOptions, this.state.options);
  }

  buildOptions({ variables = [], groupName = '', options }) {
    return variables.length > 0
      ? [
          this.getVariablesGroup(),
          {
            label: groupName,
            expanded: true,
            options,
          },
        ]
      : options;
  }

  getVariablesGroup() {
    return {
      label: 'Template Variables',
      options: this.props.variables.map(v => ({
        label: `$${v.name}`,
        value: `$${v.name}`,
      })),
    };
  }

  getSelectedOption() {
    const { options } = this.state;
    const allOptions = options.every(o => o.options) ? _.flatten(options.map(o => o.options)) : options;
    return allOptions.find(option => option.value === this.props.value);
  }

  render() {
    const { placeholder, className, isSearchable, onChange } = this.props;
    const { options } = this.state;
    const selectedOption = this.getSelectedOption();

    return (
      <Select
        className={className}
        isMulti={false}
        isClearable={false}
        backspaceRemovesValue={false}
        onChange={item => onChange(item.value)}
        options={options}
        isSearchable={isSearchable}
        maxMenuHeight={500}
        placeholder={placeholder}
        noOptionsMessage={() => 'No options found'}
        value={selectedOption}
      />
    );
  }
}
