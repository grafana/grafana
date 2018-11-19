import React, { PureComponent } from 'react';
import { GroupProps } from 'react-select/lib/components/Group';

interface ExtendedGroupProps extends GroupProps<any> {
  data: any;
}

interface State {
  expanded: boolean;
}

export default class UnitGroup extends PureComponent<ExtendedGroupProps, State> {
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
      <div className="width-21 unit-picker-group" style={{ marginBottom: '5px' }}>
        <div className="unit-picker-group-item" onClick={this.onToggleChildren}>
          <span style={{ textTransform: 'capitalize' }}>{label}</span>
          <i className={`fa ${expanded ? 'fa-minus' : 'fa-plus'}`} />{' '}
        </div>
        {expanded && children}
      </div>
    );
  }
}
