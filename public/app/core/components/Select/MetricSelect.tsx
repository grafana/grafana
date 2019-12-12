import React from 'react';
import _ from 'lodash';

import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Variable } from 'app/types/templates';

export interface Props {
  onChange: (value: string) => void;
  options: Array<SelectableValue<string>>;
  isSearchable: boolean;
  value: string;
  placeholder?: string;
  className?: string;
  variables?: Variable[];
}

interface State {
  options: Array<SelectableValue<string>>;
}

export class MetricSelect extends React.Component<Props, State> {
  static defaultProps: Partial<Props> = {
    variables: [],
    options: [],
    isSearchable: true,
  };

  constructor(props: Props) {
    super(props);
    this.state = { options: [] };
  }

  componentDidMount() {
    this.setState({ options: this.buildOptions(this.props) });
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.options.length > 0 || nextProps.variables.length) {
      this.setState({ options: this.buildOptions(nextProps) });
    }
  }

  shouldComponentUpdate(nextProps: Props) {
    const nextOptions = this.buildOptions(nextProps);
    return nextProps.value !== this.props.value || !_.isEqual(nextOptions, this.state.options);
  }

  buildOptions({ variables = [], options }: Props) {
    return variables.length > 0 ? [this.getVariablesGroup(), ...options] : options;
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
