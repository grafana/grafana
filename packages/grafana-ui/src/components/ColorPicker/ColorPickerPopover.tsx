import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { Component } from 'react';
import * as React from 'react';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { t } from '@grafana/i18n';

import { withTheme2 } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { Themeable2 } from '../../types/theme';
import { Tab } from '../Tabs/Tab';
import { TabsBar } from '../Tabs/TabsBar';
import { PopoverContentProps } from '../Tooltip/types';

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
          return <Tab label={customPickers[key].name} onChangeTab={this.onTabChange(key)} key={key} />;
        })}
      </>
    );
  };

  render() {
    const { theme } = this.props;
    const { activePicker } = this.state;

    const styles = getStyles(theme);

    return (
      <FocusScope contain restoreFocus autoFocus>
        {/*
          tabIndex=-1 is needed here to support highlighting text within the picker when using FocusScope
          see https://github.com/adobe/react-spectrum/issues/1604#issuecomment-781574668
        */}
        <div tabIndex={-1} className={styles.colorPickerPopover}>
          <TabsBar>
            <Tab
              label={t('grafana-ui.color-picker-popover.palette-tab', 'Colors')}
              onChangeTab={this.onTabChange('palette')}
              active={activePicker === 'palette'}
            />
            <Tab
              label={t('grafana-ui.color-picker-popover.spectrum-tab', 'Custom')}
              onChangeTab={this.onTabChange('spectrum')}
              active={activePicker === 'spectrum'}
            />
            {this.renderCustomPickerTabs()}
          </TabsBar>
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
      background: theme.colors.background.elevated,
      padding: theme.spacing(0.5),
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    colorPickerPopoverContent: css({
      width: '246px',
      fontSize: theme.typography.bodySmall.fontSize,
      minHeight: '184px',
      height: '290px',
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
