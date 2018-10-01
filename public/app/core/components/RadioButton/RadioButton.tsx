import React, { PureComponent } from 'react';

export interface RadioButtonProps {
  name: string;
  label: string;
  checked?: boolean;
  value;
}

export default class RadioButton extends PureComponent<RadioButtonProps> {
  setdefaultChecked() {}

  handleOptionChange(changeEvent) {
    this.setState({
      selectedOption: changeEvent.target.value,
    });
  }

  renderInput() {
    if (this.props.checked) {
      return <input type="radio" name={this.props.name} onClick={this.props.value} defaultChecked />;
    } else {
      return <input type="radio" name={this.props.name} onClick={this.props.value} />;
    }
  }

  render() {
    return (
      <label className="radio-button">
        <span className="radio-label">{this.props.label}</span>
        {this.renderInput()}
        <div className="radio-input-box" />
      </label>
    );
  }
}
