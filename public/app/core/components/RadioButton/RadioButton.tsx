import React, { PureComponent } from 'react';

export interface RadioButtonProps {
  radioName: string;
  radioLabel: string;
  checked?: boolean;
  radioFunction();
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
      return <input type="radio" name={this.props.radioName} onClick={this.props.radioFunction} defaultChecked />;
    } else {
      return <input type="radio" name={this.props.radioName} onClick={this.props.radioFunction} />;
    }
  }

  render() {
    return (
      <label className="gf-form">
        <span className="gf-form-label">{this.props.radioLabel}</span>
        <div className="radio-button">
          {this.renderInput()}
          <span className="circle" />
        </div>
      </label>
    );
  }
}
