import React from 'react';
import _ from 'lodash';

import { Select, GroupedSelectOptionItem } from '@grafana/ui/src/components/Select/Select';
import { Variable } from 'app/types/templates';

export interface Props<T> {
  onChange: (value: T) => void;
  options: Array<GroupedSelectOptionItem<T>>;
  isSearchable: boolean;
  value: T;
  placeholder?: string;
  className?: string;
  variables?: Variable[];
}

interface State<T> {
  options: Array<GroupedSelectOptionItem<T>>;
}

export class MetricSelect<T> extends React.Component<Props<T>, State<T>> {
  static defaultProps = {
    variables: [],
    options: [],
    isSearchable: true,
  };

  constructor(props) {
    super(props);
    this.state = { options: [] };
  }

  componentDidMount() {
    this.setState({ options: this.buildOptions(this.props) });
  }

  componentWillReceiveProps(nextProps: Props<T>) {
    if (nextProps.options.length > 0 || nextProps.variables.length) {
      this.setState({ options: this.buildOptions(nextProps) });
    }
  }

  shouldComponentUpdate(nextProps: Props<T>) {
    const nextOptions = this.buildOptions(nextProps);
    return nextProps.value !== this.props.value || !_.isEqual(nextOptions, this.state.options);
  }

  buildOptions({ variables = [], options }) {
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
    const allOptions = options.every(o => o.options.length > 0) ? _.flatten(options.map(o => o.options)) : options;
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
