import React, { PureComponent } from 'react';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';

interface Props {
  value?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (number?: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

interface State {
  text: string;
  inputCorrected: boolean;
}

/**
 * This is an Input field that will call `onChange` for blur and enter
 */

export class NumberInput extends PureComponent<Props, State> {
  state: State = { text: '', inputCorrected: false };

  componentDidMount() {
    this.setState({
      ...this.state,
      text: isNaN(this.props.value!) ? '' : `${this.props.value}`,
    });
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.value !== oldProps.value) {
      this.setState({
        ...this.state,
        text: isNaN(this.props.value!) ? '' : `${this.props.value}`,
      });
    }
  }

  onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let value: number | undefined = undefined;
    const txt = e.currentTarget.value;
    if (txt && !isNaN(e.currentTarget.valueAsNumber)) {
      value = e.currentTarget.valueAsNumber;
    }
    this.props.onChange(value);
    this.setState({ ...this.state, inputCorrected: false });
  };

  onChange = (e: React.FocusEvent<HTMLInputElement>) => {
    let newValue: string | undefined = undefined;
    let corrected = false;
    const min = this.props.min;
    const max = this.props.max;
    const currValue = e.currentTarget.valueAsNumber;
    if (!Number.isNaN(currValue)) {
      if (min != null && currValue < min) {
        newValue = min.toString();
        corrected = true;
      } else if (max != null && currValue > max) {
        newValue = max.toString();
        corrected = true;
      } else {
        newValue = e.currentTarget.value;
      }
    }
    this.setState({
      ...this.state,
      text: newValue ? newValue : '',
      inputCorrected: corrected,
    });
  };

  onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.onBlur(e as any);
    }
  };

  renderInput() {
    return (
      <Input
        type="number"
        min={this.props.min}
        max={this.props.max}
        step={this.props.step}
        autoFocus={this.props.autoFocus}
        value={this.state.text}
        onChange={this.onChange}
        onBlur={this.onBlur}
        onKeyPress={this.onKeyPress}
        placeholder={this.props.placeholder}
      />
    );
  }

  render() {
    const { inputCorrected } = this.state;
    if (inputCorrected) {
      return (
        <Field invalid={inputCorrected} error={'Cannot go beyond range'}>
          {this.renderInput()}
        </Field>
      );
    }

    return this.renderInput();
  }
}
