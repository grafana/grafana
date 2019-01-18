import React, { Children } from 'react';
import NamedColorsPicker from './NamedColorsPicker';
import { Color } from 'csstype';
import { ColorDefinition, getColorName } from '../..//utils/colorsPalette';
import { SpectrumPicker } from './SpectrumPicker';
import { GrafanaTheme } from '../../types';

// const DEFAULT_COLOR = '#000000';

export interface Props {
  color: Color | string;
  theme?: GrafanaTheme;
  onColorSelect: (color: string | ColorDefinition) => void;
}

type PickerType = 'palette' | 'spectrum';

interface State {
  activePicker: PickerType;
}

export class ColorPickerPopover extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      activePicker: 'spectrum',
    };
  }

  handleSpectrumColorSelect = (color: any) => {
    this.props.onColorSelect(color.toRgbString());
  };

  renderPicker = () => {
    const { activePicker } = this.state;
    const { color } = this.props;

    return activePicker === 'spectrum' ? (
      <SpectrumPicker color={color} onColorSelect={this.handleSpectrumColorSelect} options={{}} />
    ) : (
      <NamedColorsPicker selectedColor={getColorName(color)} onChange={this.props.onColorSelect} />
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
