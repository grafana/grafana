import React, { Component } from 'react';

export interface IProps {
  onSelect: any;
  onFocus: any;
  option: any;
  isFocused: any;
  className: any;
}

class UserPickerOption extends Component<IProps, any> {
  constructor(props) {
    super(props);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseEnter = this.handleMouseEnter.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
  }

  handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    this.props.onSelect(this.props.option, event);
  }

  handleMouseEnter(event) {
    this.props.onFocus(this.props.option, event);
  }

  handleMouseMove(event) {
    if (this.props.isFocused) {
      return;
    }
    this.props.onFocus(this.props.option, event);
  }

  render() {
    const { option, children, className } = this.props;

    return (
      <button
        onMouseDown={this.handleMouseDown}
        onMouseEnter={this.handleMouseEnter}
        onMouseMove={this.handleMouseMove}
        title={option.title}
        className={`user-picker-option__button btn btn-link ${className}`}
      >
        <img src={option.avatarUrl} alt={option.label} className="user-picker-option__avatar" />
        {children}
      </button>
    );
  }
}

export default UserPickerOption;
