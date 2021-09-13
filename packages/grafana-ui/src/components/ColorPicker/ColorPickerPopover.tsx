import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { PopoverContentProps } from '../Tooltip/Tooltip';
import SpectrumPalette from './SpectrumPalette';
import { Themeable2 } from '../../types/theme';
import { warnAboutColorPickerPropsDeprecation } from './warnAboutColorPickerPropsDeprecation';
import { css } from '@emotion/css';
import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { stylesFactory, withTheme2 } from '../../themes';

export type ColorPickerChangeHandler = (color: string) => void;

export interface ColorPickerProps extends Themeable2 {
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

class UnThemedColorPickerPopover<T extends CustomPickersDescriptor> extends React.Component<Props<T>, State<T>> {
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
    changeHandler(colorManipulator.asHexString(theme.visualization.getColorByName(color)));
  };

  onTabChange = (tab: PickerType | keyof T) => {
    return () => this.setState({ activePicker: tab });
  };

  renderPicker = () => {
    const { activePicker } = this.state;
    const { color } = this.props;

    switch (activePicker) {
      case 'spectrum':
        return <SpectrumPalette color={color} onChange={this.handleChange} />;
      case 'palette':
        return <NamedColorsPalette color={color} onChange={this.handleChange} />;
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
        {Object.keys(customPickers).map((key) => {
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
    const styles = getStyles(theme);
    return (
      <div className={styles.colorPickerPopover}>
        <div className={styles.colorPickerPopoverTabs}>
          <div className={this.getTabClassName('palette')} onClick={this.onTabChange('palette')}>
            Colors
          </div>
          <div className={this.getTabClassName('spectrum')} onClick={this.onTabChange('spectrum')}>
            Custom
          </div>
          {this.renderCustomPickerTabs()}
        </div>
        <div className={styles.colorPickerPopoverContent}>{this.renderPicker()}</div>
      </div>
    );
  }
}

export const ColorPickerPopover = withTheme2(UnThemedColorPickerPopover);
ColorPickerPopover.displayName = 'ColorPickerPopover';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    colorPickerPopover: css`
      border-radius: ${theme.shape.borderRadius()};
      box-shadow: ${theme.shadows.z3};
      background: ${theme.colors.background.primary};

      .ColorPickerPopover__tab {
        width: 50%;
        text-align: center;
        padding: ${theme.spacing(1, 0)};
        background: ${theme.colors.background.secondary};
        color: ${theme.colors.text.secondary};
        cursor: pointer;
      }

      .ColorPickerPopover__tab--active {
        color: ${theme.colors.text.primary};
        font-weight: ${theme.typography.fontWeightMedium};
        background: ${theme.colors.background.primary};
      }
    `,
    colorPickerPopoverContent: css`
      width: 336px;
      font-size: ${theme.typography.bodySmall.fontSize};
      min-height: 184px;
      padding: ${theme.spacing(2)};
      display: flex;
      align-items: center;
      justify-content: center;
    `,
    colorPickerPopoverTabs: css`
      display: flex;
      width: 100%;
      border-radius: ${theme.shape.borderRadius()} ${theme.shape.borderRadius()} 0 0;
      overflow: hidden;
    `,
  };
});
