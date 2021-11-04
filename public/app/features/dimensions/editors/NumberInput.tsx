import React, { PureComponent } from 'react';
import { Input } from '@grafana/ui';

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
}

/**
 * This is an Input field that will call `onChange` for blur and enter
 */
export class NumberInput extends PureComponent<Props, State> {
  state: State = { text: '' };

  componentDidMount() {
    this.setState({
      text: isNaN(this.props.value!) ? '' : `${this.props.value}`,
    });
  }

  componentDidUpdate(oldProps: Props) {
    if (this.props.value !== oldProps.value) {
      this.setState({
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
  };

  onChange = (e: React.FocusEvent<HTMLInputElement>) => {
    this.setState({
      text: e.currentTarget.value,
    });
  };

  onKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.onBlur(e as any);
    }
  };

  render() {
    const { placeholder } = this.props;
    const { text } = this.state;
    return (
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
    );
  }
}
