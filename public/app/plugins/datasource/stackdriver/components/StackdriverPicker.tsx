import React from 'react';
import _ from 'lodash';
import Select from 'app/core/components/Select/Select';

export interface Props {
  onChange: (value: string) => void;
  options: any[];
  isSearchable: boolean;
  selected: string;
  placeholder?: string;
  className?: string;
  groupName?: string;
  templateVariables?: any[];
}

interface State {
  options: any[];
}

export class StackdriverPicker extends React.Component<Props, State> {
  static defaultProps = {
    templateVariables: [],
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
    if (nextProps.options.length > 0 || nextProps.templateVariables.length) {
      this.setState({ options: this.buildOptions(nextProps) });
    }
  }

  shouldComponentUpdate(nextProps: Props) {
    const nextOptions = this.buildOptions(nextProps);
    return nextProps.selected !== this.props.selected || !_.isEqual(nextOptions, this.state.options);
  }

  buildOptions({ templateVariables = [], groupName = '', options }) {
    return templateVariables.length > 0
      ? [
          this.getTemplateVariablesGroup(),
          {
            label: groupName,
            expanded: true,
            options,
          },
        ]
      : options;
  }

  getTemplateVariablesGroup() {
    return {
      label: 'Template Variables',
      options: this.props.templateVariables.map(v => ({
        label: `$${v.name}`,
        value: `$${v.name}`,
      })),
    };
  }

  getSelectedOption() {
    const { options } = this.state;
    const allOptions = options.every(o => o.options) ? _.flatten(options.map(o => o.options)) : options;
    return allOptions.find(option => option.value === this.props.selected);
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
