import React from 'react';
import tinycolor from 'tinycolor2';
import { debounce } from 'lodash';

import { ColorPickerProps } from './ColorPickerPopover';
import { Input } from '../Input/Input';
import { useStyles } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { cx, css } from '@emotion/css';

interface ColorInputState {
  previousColor: string;
  value: string;
}

interface ColorInputProps extends ColorPickerProps {
  style?: React.CSSProperties;
  className?: string;
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
      <Input
        className={this.props.className}
        value={value}
        onChange={this.onChange}
        onBlur={this.onBlur}
        addonBefore={<ColorPreview color={this.props.color} />}
      />
    );
  }
}

export default ColorInput;

interface ColorPreviewProps {
  color: string;
}

const ColorPreview = ({ color }: ColorPreviewProps) => {
  const styles = useStyles(getColorPreviewStyles);

  return (
    <div
      className={cx(
        styles,
        css`
          background-color: ${color};
        `
      )}
    />
  );
};

const getColorPreviewStyles = (theme: GrafanaTheme) => css`
  height: 100%;
  width: ${theme.spacing.formInputHeight}px;
  border-radius: ${theme.border.radius.sm} 0 0 ${theme.border.radius.sm};
  border: 1px solid ${theme.colors.formInputBorder};
`;
