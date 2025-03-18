import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { Component } from 'react';
import * as React from 'react';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';

import { stylesFactory, withTheme2 } from '../../themes';
import { Themeable2 } from '../../types/theme';
import { Trans } from '../../utils/i18n';
import { PopoverContentProps } from '../Tooltip';

import { NamedColorsPalette } from './NamedColorsPalette';
import SpectrumPalette from './SpectrumPalette';

export type ColorPickerChangeHandler = (color: string) => void;

export interface ColorPickerProps extends Themeable2 {
  color: string;
  onChange: ColorPickerChangeHandler;

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

class UnThemedColorPickerPopover<T extends CustomPickersDescriptor> extends Component<Props<T>, State<T>> {
  constructor(props: Props<T>) {
    super(props);
    this.state = {
      activePicker: 'palette',
    };
  }

  getTabClassName = (tabName: PickerType | keyof T) => {
    const { activePicker } = this.state;
    return `ColorPickerPopover__tab ${activePicker === tabName && 'ColorPickerPopover__tab--active'}`;
  };

  handleChange = (color: string) => {
    const { onChange, enableNamedColors, theme } = this.props;
    if (enableNamedColors) {
      return onChange(color);
    }
    onChange(colorManipulator.asHexString(theme.visualization.getColorByName(color)));
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
            <button className={this.getTabClassName(key)} onClick={this.onTabChange(key)} key={key} type="button">
              {customPickers[key].name}
            </button>
          );
        })}
      </>
    );
  };

  render() {
    const { theme } = this.props;
    const styles = getStyles(theme);
    return (
      <FocusScope contain restoreFocus autoFocus>
        {/*
          tabIndex=-1 is needed here to support highlighting text within the picker when using FocusScope
          see https://github.com/adobe/react-spectrum/issues/1604#issuecomment-781574668
        */}
        <div tabIndex={-1} className={styles.colorPickerPopover}>
          <div className={styles.colorPickerPopoverTabs}>
            <button className={this.getTabClassName('palette')} onClick={this.onTabChange('palette')} type="button">
              <Trans i18nKey="grafana-ui.color-picker-popover.palette-tab">Colors</Trans>
            </button>
            <button className={this.getTabClassName('spectrum')} onClick={this.onTabChange('spectrum')} type="button">
              <Trans i18nKey="grafana-ui.color-picker-popover.spectrum-tab">Custom</Trans>
            </button>
            {this.renderCustomPickerTabs()}
          </div>
          <div className={styles.colorPickerPopoverContent}>{this.renderPicker()}</div>
        </div>
      </FocusScope>
    );
  }
}

export const ColorPickerPopover = withTheme2(UnThemedColorPickerPopover);
ColorPickerPopover.displayName = 'ColorPickerPopover';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    colorPickerPopover: css({
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,

      '.ColorPickerPopover__tab': {
        width: '50%',
        textAlign: 'center',
        padding: theme.spacing(1, 0),
        background: theme.colors.background.secondary,
        color: theme.colors.text.secondary,
        fontSize: theme.typography.bodySmall.fontSize,
        cursor: 'pointer',
        border: 'none',

        '&:focus:not(:focus-visible)': {
          outline: 'none',
          boxShadow: 'none',
        },

        ':focus-visible': {
          position: 'relative',
        },
      },

      '.ColorPickerPopover__tab--active': {
        color: theme.colors.text.primary,
        fontWeight: theme.typography.fontWeightMedium,
        background: theme.colors.background.primary,
      },
    }),
    colorPickerPopoverContent: css({
      width: '246px',
      fontSize: theme.typography.bodySmall.fontSize,
      minHeight: '184px',
      padding: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
    }),
    colorPickerPopoverTabs: css({
      display: 'flex',
      width: '100%',
      borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
    }),
  };
});
