import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { getColorName, getColorFromHexRgbOrName } from '../../utils/namedColorsPalette';
import { ColorPickerProps, handleColorPickerPropsDeprecation } from './ColorPicker';
import { GrafanaTheme, Themeable } from '../../types';
import { PopperContentProps } from '../Tooltip/PopperController';
import SpectrumPalette from './SpectrumPalette';

export interface Props extends ColorPickerProps, Themeable, PopperContentProps {}

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
    handleColorPickerPropsDeprecation('ColorPickerPopover', props);
  }

  handleChange = (color: any) => {
    const { onColorChange, onChange, enableNamedColors } = this.props;
    const changeHandler = onColorChange || onChange;

    if (enableNamedColors) {
      return changeHandler(color);
    }
    changeHandler(getColorFromHexRgbOrName(color));
  };

  renderPicker = () => {
    const { activePicker } = this.state;
    const { color, theme } = this.props;

    return activePicker === 'spectrum' ? (
      <SpectrumPalette color={color} onChange={this.handleChange} theme={theme} />
    ) : (
      <NamedColorsPalette color={getColorName(color, theme)} onChange={this.handleChange} theme={theme} />
    );
  };

  render() {
    const { activePicker } = this.state;
    const { theme, children, updatePopperPosition } = this.props;
    const colorPickerTheme = theme || GrafanaTheme.Dark;

    return (
      <div className={`ColorPickerPopover ColorPickerPopover--${colorPickerTheme}`}>
        <div className="ColorPickerPopover__tabs">
          <div
            className={`ColorPickerPopover__tab ${activePicker === 'palette' && 'ColorPickerPopover__tab--active'}`}
            onClick={() => {
              this.setState({ activePicker: 'palette' }, () => {
                if (updatePopperPosition) {
                  updatePopperPosition();
                }
              });
            }}
          >
            Default
          </div>
          <div
            className={`ColorPickerPopover__tab ${activePicker === 'spectrum' && 'ColorPickerPopover__tab--active'}`}
            onClick={() => {
              this.setState({ activePicker: 'spectrum' }, () => {
                if (updatePopperPosition) {
                  updatePopperPosition();
                }
              });
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
