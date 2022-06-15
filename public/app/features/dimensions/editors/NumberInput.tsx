import React, { PureComponent } from 'react';

import { Field, Input } from '@grafana/ui';

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

  render() {
    const { placeholder } = this.props;
    const { text, inputCorrected } = this.state;
    return (
      <Field invalid={inputCorrected} error={inputCorrected ? 'Cannot go beyond range' : ''}>
        <Input
          type="number"
          min={this.props.min}
          max={this.props.max}
          step={this.props.step}
          autoFocus={this.props.autoFocus}
          value={text}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onKeyPress={this.onKeyPress}
          placeholder={placeholder}
        />
      </Field>
    );
  }
}
