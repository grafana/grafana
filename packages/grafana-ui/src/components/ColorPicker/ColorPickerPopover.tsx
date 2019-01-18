import React from 'react';
import NamedColorsPicker from './NamedColorsPalette';
import { getColorName } from '../..//utils/colorsPalette';
import { SpectrumPalette } from './SpectrumPalette';
import { ColorPickerProps } from './ColorPicker';
import { GrafanaTheme, Themeable } from '../../types';

// const DEFAULT_COLOR = '#000000';

export interface Props extends ColorPickerProps, Themeable {}

type PickerType = 'palette' | 'spectrum';

interface State {
  activePicker: PickerType;
}

export class ColorPickerPopover extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activePicker: 'palette',
    };
  }

  handleSpectrumColorSelect = (color: any) => {
    this.props.onChange(color.toRgbString());
  };

  renderPicker = () => {
    const { activePicker } = this.state;
    const { color, onChange, theme } = this.props;

    return activePicker === 'spectrum' ? (
      <SpectrumPalette color={color} onColorSelect={this.handleSpectrumColorSelect} options={{}} />
    ) : (
      <NamedColorsPicker color={getColorName(color)} onChange={onChange} theme={theme} />
    );
  };

  render() {
    const { activePicker } = this.state;
    const { theme, children } = this.props;
    const colorPickerTheme = theme || GrafanaTheme.Dark;

    return (
      <div className={`ColorPickerPopover ColorPickerPopover--${colorPickerTheme}`}>
        <div className="ColorPickerPopover__tabs">
          <div
            className={`ColorPickerPopover__tab ${activePicker === 'palette' && 'ColorPickerPopover__tab--active'}`}
            onClick={() => {
              this.setState({ activePicker: 'palette' });
            }}
          >
            Default
          </div>
          <div
            className={`ColorPickerPopover__tab ${activePicker === 'spectrum' && 'ColorPickerPopover__tab--active'}`}
            onClick={() => {
              this.setState({ activePicker: 'spectrum' });
            }}
          >
            Custom
          </div>
        </div>

        <div className="ColorPickerPopover__content">
          {this.renderPicker()}
          {children}
        </div>
      </div>
    );
  }
}
