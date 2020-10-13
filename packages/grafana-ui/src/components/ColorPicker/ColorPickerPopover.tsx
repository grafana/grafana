import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { PopoverContentProps } from '../Tooltip/Tooltip';
import SpectrumPalette from './SpectrumPalette';
import { Themeable } from '../../types/theme';
import { warnAboutColorPickerPropsDeprecation } from './warnAboutColorPickerPropsDeprecation';
import { GrafanaThemeType, getColorForTheme } from '@grafana/data';

export type ColorPickerChangeHandler = (color: string) => void;

export interface ColorPickerProps extends Themeable {
  color: string;
  onChange: ColorPickerChangeHandler;

  /**
   * @deprecated Use onChange instead
   */
  onColorChange?: ColorPickerChangeHandler;
  enableNamedColors?: boolean;
}

export interface Props<T> extends ColorPickerProps, PopoverContentProps {
  customPickers?: T;
}

type PickerType = 'palette' | 'spectrum';

export interface CustomPickersDescriptor {
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
    warnAboutColorPickerPropsDeprecation('ColorPickerPopover', props);
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
    changeHandler(getColorForTheme(color, theme));
  };

  onTabChange = (tab: PickerType | keyof T) => {
    return () => this.setState({ activePicker: tab });
  };

  renderPicker = () => {
    const { activePicker } = this.state;
    const { color, theme } = this.props;

    switch (activePicker) {
      case 'spectrum':
        return <SpectrumPalette color={color} onChange={this.handleChange} theme={theme} />;
      case 'palette':
        return <NamedColorsPalette color={color} onChange={this.handleChange} theme={theme} />;
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

  renderCustomPickerTabs = () => {
    const { customPickers } = this.props;

    if (!customPickers) {
      return null;
    }

    return (
      <>
        {Object.keys(customPickers).map(key => {
          return (
            <div className={this.getTabClassName(key)} onClick={this.onTabChange(key)} key={key}>
              {customPickers[key].name}
            </div>
          );
        })}
      </>
    );
  };

  render() {
    const { theme } = this.props;
    const colorPickerTheme = theme.type || GrafanaThemeType.Dark;
    return (
      <div className={`ColorPickerPopover ColorPickerPopover--${colorPickerTheme}`}>
        <div className="ColorPickerPopover__tabs">
          <div className={this.getTabClassName('palette')} onClick={this.onTabChange('palette')}>
            Colors
          </div>
          <div className={this.getTabClassName('spectrum')} onClick={this.onTabChange('spectrum')}>
            Custom
          </div>
          {this.renderCustomPickerTabs()}
        </div>

        <div className="ColorPickerPopover__content">{this.renderPicker()}</div>
      </div>
    );
  }
}
