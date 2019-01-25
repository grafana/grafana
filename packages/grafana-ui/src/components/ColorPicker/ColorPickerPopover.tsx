import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { getColorName, getColorFromHexRgbOrName } from '../../utils/namedColorsPalette';
import { ColorPickerProps, handleColorPickerPropsDeprecation } from './ColorPicker';
import { GrafanaTheme } from '../../types';
import { PopperContentProps } from '../Tooltip/PopperController';
import SpectrumPalette from './SpectrumPalette';

export interface Props<T> extends ColorPickerProps, PopperContentProps {
  customPickers?: T;
}

type PickerType = 'palette' | 'spectrum';

interface CustomPickersDescriptor {
  [key: string]: {
    tabComponent: React.ComponentType<ColorPickerProps>;
    name: string;
  };
}
interface State<T> {
  activePicker: PickerType | keyof T;
}

export class ColorPickerPopover<T extends CustomPickersDescriptor> extends React.Component<Props<T>, State<T>> {
  constructor(props: Props<T>) {
    super(props);
    this.state = {
      activePicker: 'palette',
    };
    handleColorPickerPropsDeprecation('ColorPickerPopover', props);
  }

  getTabClassName = (tabName: PickerType | keyof T) => {
    const { activePicker } = this.state;
    return `ColorPickerPopover__tab ${activePicker === tabName && 'ColorPickerPopover__tab--active'}`;
  };

  handleChange = (color: any) => {
    const { onColorChange, onChange, enableNamedColors, theme } = this.props;
    const changeHandler = onColorChange || onChange;

    if (enableNamedColors) {
      return changeHandler(color);
    }
    changeHandler(getColorFromHexRgbOrName(color, theme));
  };

  handleTabChange = (tab: PickerType | keyof T, updatePopperPosition?: () => void) => {
    return () =>
      this.setState({ activePicker: tab }, () => {
        if (updatePopperPosition) {
          updatePopperPosition();
        }
      });
  };

  renderPicker = () => {
    const { activePicker } = this.state;
    const { color, theme } = this.props;

    switch (activePicker) {
      case 'spectrum':
        return <SpectrumPalette color={color} onChange={this.handleChange} theme={theme} />;
      case 'palette':
        return <NamedColorsPalette color={getColorName(color, theme)} onChange={this.handleChange} theme={theme} />;
      default:
        return this.renderCustomPicker(activePicker);
    }
  };

  renderCustomPicker = (tabKey: keyof T) => {
    const { customPickers, color, theme } = this.props;
    if (!customPickers) {
      return null;
    }

    return React.createElement(customPickers[tabKey].tabComponent, {
      color,
      theme,
      onChange: this.handleChange,
    });
  };

  renderCustomPickerTabs = (updatePopperPosition?: () => void) => {
    const { customPickers } = this.props;

    if (!customPickers) {
      return null;
    }

    return (
      <>
        {Object.keys(customPickers).map(key => {
          return (
            <div
              className={this.getTabClassName(key)}
              onClick={this.handleTabChange(key, updatePopperPosition)}
              key={key}
            >
              {customPickers[key].name}
            </div>
          );
        })}
      </>
    );
  };

  render() {
    const { theme, updatePopperPosition } = this.props;
    const colorPickerTheme = theme || GrafanaTheme.Dark;

    return (
      <div className={`ColorPickerPopover ColorPickerPopover--${colorPickerTheme}`}>
        <div className="ColorPickerPopover__tabs">
          <div
            className={this.getTabClassName('palette')}
            onClick={this.handleTabChange('palette', updatePopperPosition)}
          >
            Colors
          </div>
          <div
            className={this.getTabClassName('spectrum')}
            onClick={this.handleTabChange('spectrum', updatePopperPosition)}
          >
            Custom
          </div>
          {this.renderCustomPickerTabs(updatePopperPosition)}
        </div>

        <div className="ColorPickerPopover__content">{this.renderPicker()}</div>
      </div>
    );
  }
}
