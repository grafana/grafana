import React, { PureComponent } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';

interface ExtendedGroupProps extends GroupProps<any> {
  data: {
    label: string;
    expanded: boolean;
    options: any[];
  };
}

interface State {
  expanded: boolean;
}

export default class SelectOptionGroup extends PureComponent<ExtendedGroupProps, State> {
  state = {
    expanded: false,
  };

  componentDidMount() {
    if (this.props.data.expanded) {
      this.setState({ expanded: true });
    } else if (this.props.selectProps && this.props.selectProps.value) {
      const { value } = this.props.selectProps.value;

      if (value && this.props.options.some(option => option.value === value)) {
        this.setState({ expanded: true });
      }
    }
  }

  componentDidUpdate(nextProps: ExtendedGroupProps) {
    if (nextProps.selectProps.inputValue !== '') {
      this.setState({ expanded: true });
    }
  }

  onToggleChildren = () => {
    this.setState(prevState => ({
      expanded: !prevState.expanded,
    }));
  };

  render() {
    const { children, label } = this.props;
    const { expanded } = this.state;

    return (
      <div className="gf-form-select-box__option-group">
        <div className="gf-form-select-box__option-group__header" onClick={this.onToggleChildren}>
          <span className="flex-grow-1">{label}</span>
          <i className={`fa ${expanded ? 'fa-caret-left' : 'fa-caret-down'}`} />{' '}
        </div>
        {expanded && children}
      </div>
    );
  }
}
