import { debounce } from 'lodash';
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
  width?: number;
  fieldDisabled?: boolean;
}

interface State {
  text: string;
  inputCorrected: boolean;
}

/**
 * This is an Input field that will call `onChange` for blur and enter
 *
 * @internal this is not exported to the `@grafana/ui` library, it is used
 * by options editor (number and slider), and direclty with in grafana core
 */

export class NumberInput extends PureComponent<Props, State> {
  state: State = { text: '', inputCorrected: false };
  inputRef = React.createRef<HTMLInputElement>();

  componentDidMount() {
    this.setState({
      text: isNaN(this.props.value!) ? '' : `${this.props.value}`,
    });
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.value !== oldProps.value) {
      const text = isNaN(this.props.value!) ? '' : `${this.props.value}`;
      if (text !== this.state.text) {
        this.setState({ text });
      }
    }
  }

  updateValue = () => {
    const txt = this.inputRef.current?.value;
    let corrected = false;
    let newValue = '';
    const min = this.props.min;
    const max = this.props.max;
    let currentValue = txt !== '' ? Number(txt) : undefined;

    if (currentValue && !Number.isNaN(currentValue)) {
      if (min != null && currentValue < min) {
        newValue = min.toString();
        corrected = true;
      } else if (max != null && currentValue > max) {
        newValue = max.toString();
        corrected = true;
      } else {
        newValue = txt ?? '';
      }

      this.setState({
        text: newValue,
        inputCorrected: corrected,
      });
    }

    if (corrected) {
      this.updateValueDebounced();
    }

    if (!Number.isNaN(currentValue) && currentValue !== this.props.value) {
      this.props.onChange(currentValue);
    }
  };

  updateValueDebounced = debounce(this.updateValue, 500); // 1/2 second delay

  onChange = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({
      text: e.currentTarget.value,
    });
    this.updateValueDebounced();
  };

  onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.updateValue();
    }
  };

  renderInput() {
    return (
      <Input
        type="number"
        ref={this.inputRef}
        min={this.props.min}
        max={this.props.max}
        step={this.props.step}
        autoFocus={this.props.autoFocus}
        value={this.state.text}
        onChange={this.onChange}
        onBlur={this.updateValue}
        onKeyPress={this.onKeyPress}
        placeholder={this.props.placeholder}
        disabled={this.props.fieldDisabled}
        width={this.props.width}
      />
    );
  }

  render() {
    const { inputCorrected } = this.state;
    if (inputCorrected) {
      let range = '';
      let { min, max } = this.props;
      if (max == null) {
        if (min != null) {
          range = `< ${min}`;
        }
      } else if (min != null) {
        range = `${min} < > ${max}`;
      } else {
        range = `> ${max}`;
      }
      return (
        <Field
          invalid={inputCorrected}
          error={`Out of range ${range}`}
          validationMessageHorizontalOverflow={true}
          style={{ direction: 'rtl' }}
        >
          {this.renderInput()}
        </Field>
      );
    }

    return this.renderInput();
  }
}
