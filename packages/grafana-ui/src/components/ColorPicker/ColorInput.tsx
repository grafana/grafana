import React from 'react';
import tinycolor from 'tinycolor2';
import debounce from 'lodash/debounce';

import { ColorPickerProps } from './ColorPickerPopover';
import { Input } from '../Forms/Legacy/Input/Input';

interface ColorInputState {
  previousColor: string;
  value: string;
}

interface ColorInputProps extends ColorPickerProps {
  style?: React.CSSProperties;
}

class ColorInput extends React.PureComponent<ColorInputProps, ColorInputState> {
  constructor(props: ColorInputProps) {
    super(props);
    this.state = {
      previousColor: props.color,
      value: props.color,
    };

    this.updateColor = debounce(this.updateColor, 100);
  }

  static getDerivedStateFromProps(props: ColorPickerProps, state: ColorInputState) {
    const newColor = tinycolor(props.color);
    if (newColor.isValid() && props.color !== state.previousColor) {
      return {
        ...state,
        previousColor: props.color,
        value: newColor.toString(),
      };
    }

    return state;
  }
  updateColor = (color: string) => {
    this.props.onChange(color);
  };

  onChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newColor = tinycolor(event.currentTarget.value);

    this.setState({
      value: event.currentTarget.value,
    });

    if (newColor.isValid()) {
      this.updateColor(newColor.toString());
    }
  };

  onBlur = () => {
    const newColor = tinycolor(this.state.value);

    if (!newColor.isValid()) {
      this.setState({
        value: this.props.color,
      });
    }
  };

  render() {
    const { value } = this.state;
    return (
      <div
        style={{
          display: 'flex',
          ...this.props.style,
        }}
      >
        <div
          style={{
            background: this.props.color,
            width: '35px',
            height: '35px',
            flexGrow: 0,
            borderRadius: '3px 0 0 3px',
          }}
        />
        <div
          style={{
            flexGrow: 1,
          }}
        >
          <Input className="gf-form-input" value={value} onChange={this.onChange} onBlur={this.onBlur} />
        </div>
      </div>
    );
  }
}

export default ColorInput;
