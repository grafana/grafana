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
      <label className="radio-button">
        <span className="radio-label">{this.props.radioLabel}</span>
        {this.renderInput()}
        <div className="radio-input-box">
          <div className="ring">
            <div className="sphere" />
          </div>
        </div>
      </label>
    );
  }
}
