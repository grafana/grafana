import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import { PopoverContentProps } from '../Tooltip/Tooltip';
import SpectrumPalette from './SpectrumPalette';
import { Themeable } from '../../types/theme';
import { warnAboutColorPickerPropsDeprecation } from './warnAboutColorPickerPropsDeprecation';
import { css, cx } from 'emotion';
import { GrafanaTheme, GrafanaThemeType, getColorForTheme } from '@grafana/data';
import { stylesFactory, withTheme } from '../../themes';

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
      <div
        className={cx(
          styles.colorPickerPopover,
          theme.type === GrafanaThemeType.Light ? styles.colorPickerPopoverLight : styles.colorPickerPopoverDark
        )}
      >
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

export const ColorPickerPopover = withTheme(UnThemedColorPickerPopover);
ColorPickerPopover.displayName = 'ColorPickerPopover';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    colorPickerPopover: css`
      border-radius: ${theme.border.radius.md};
    `,
    colorPickerPopoverLight: css`
      color: ${theme.palette.black};
      background: linear-gradient(180deg, ${theme.palette.white} 0%, #f7f8fa 104.25%);
      box-shadow: 0px 2px 4px #dde4ed, 0px 0px 2px #dde4ed;

      .ColorPickerPopover__tab {
        width: 50%;
        text-align: center;
        padding: ${theme.spacing.sm} 0;
        background: #dde4ed;
      }
      .ColorPickerPopover__tab--active {
        background: ${theme.palette.white};
      }
    `,
    colorPickerPopoverDark: css`
      color: #d8d9da;
      background: linear-gradient(180deg, #1e2028 0%, #161719 104.25%);
      box-shadow: 0px 2px 4px ${theme.palette.black}, 0px 0px 2px ${theme.palette.black};

      .ColorPickerPopover__tab {
        width: 50%;
        text-align: center;
        padding: ${theme.spacing.sm} 0;
        background: #303133;
        color: ${theme.palette.white};
        cursor: pointer;
      }
      .ColorPickerPopover__tab--active {
        background: none;
      }
    `,
    colorPickerPopoverContent: css`
      width: 336px;
      min-height: 184px;
      padding: ${theme.spacing.lg};
    `,
    colorPickerPopoverTabs: css`
      display: flex;
      width: 100%;
      border-radius: ${theme.border.radius.md} ${theme.border.radius.md} 0 0;
      overflow: hidden;
    `,
  };
});
