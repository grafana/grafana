import React, { PureComponent } from 'react';

interface ToggleButtonProps {
  onChange?: (value) => void;
  selected?: boolean;
  value: any;
  classNames?: string;
}
interface ToggleButtonState {}

export default class ToggleButton extends PureComponent<ToggleButtonProps, ToggleButtonState> {
  static defaultProps = {
    classNames: '',
  };

  handleChange = () => {
    const { onChange, value } = this.props;
    if (onChange) {
      onChange(value);
    }
  };

  render() {
    const { children, selected, classNames } = this.props;
    const btnClassName = `btn ${classNames} ${selected ? 'active' : ''}`;

    return (
      <button className={btnClassName} onClick={this.handleChange}>
        <span>{children}</span>
      </button>
    );
  }
}
