import React, { PureComponent } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';

interface ExtendedGroupProps extends GroupProps<any> {
  data: any;
}

interface State {
  expanded: boolean;
}

export default class OptionGroup extends PureComponent<ExtendedGroupProps, State> {
  state = {
    expanded: false,
  };

  componentDidMount() {
    if (this.props.selectProps) {
      const value = this.props.selectProps.value[this.props.selectProps.value.length - 1];

      if (value && this.props.options.some(option => option.value === value)) {
        this.setState({ expanded: true });
      }
    }
  }

  componentDidUpdate(nextProps) {
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
          <span className="flex-grow">{label}</span>
          <i className={`fa ${expanded ? 'fa-caret-left' : 'fa-caret-down'}`} />{' '}
        </div>
        {expanded && children}
      </div>
    );
  }
}
