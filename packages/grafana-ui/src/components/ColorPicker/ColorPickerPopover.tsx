import { css } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { type ComponentType, createElement, useState } from 'react';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Tab } from '../Tabs/Tab';
import { TabsBar } from '../Tabs/TabsBar';
import { PopoverContentProps } from '../Tooltip/types';

import { NamedColorsPalette } from './NamedColorsPalette';
import SpectrumPalette from './SpectrumPalette';

export type ColorPickerChangeHandler = (color: string) => void;

export interface ColorPickerProps {
  color: string;
  onChange: ColorPickerChangeHandler;
  enableNamedColors?: boolean;
  id?: string;
}

export interface Props<T> extends ColorPickerProps, PopoverContentProps {
  customPickers?: T;
}

export interface CustomPickersDescriptor {
  [key: string]: {
    tabComponent: ComponentType<ColorPickerProps>;
    name: string;
  };
}

type PickerType = 'palette' | 'spectrum';

export const ColorPickerPopover = <T extends CustomPickersDescriptor>(props: Props<T>) => {
  const { color, onChange, enableNamedColors, customPickers } = props;
  const theme = useTheme2();
  const [activePicker, setActivePicker] = useState<PickerType | keyof T>('palette');

  const styles = getStyles(theme);

  const handleChange = (color: string) => {
    if (enableNamedColors) {
      return onChange(color);
    }
    onChange(colorManipulator.asHexString(theme.visualization.getColorByName(color)));
  };

  const onTabChange = (tab: PickerType | keyof T) => {
    return () => setActivePicker(tab);
  };

  const renderCustomPicker = (tabKey: keyof T) => {
    if (!customPickers) {
      return null;
    }

    return createElement(customPickers[tabKey].tabComponent, {
      color,
      onChange: handleChange,
    });
  };

  const renderPicker = () => {
    switch (activePicker) {
      case 'spectrum':
        return <SpectrumPalette color={color} onChange={handleChange} />;
      case 'palette':
        return <NamedColorsPalette color={color} onChange={handleChange} />;
      default:
        return renderCustomPicker(activePicker);
    }
  };

  const renderCustomPickerTabs = () => {
    if (!customPickers) {
      return null;
    }

    return (
      <>
        {Object.keys(customPickers).map((key) => {
          return <Tab label={customPickers[key].name} onChangeTab={onTabChange(key)} key={key} />;
        })}
      </>
    );
  };

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
            onChangeTab={onTabChange('palette')}
            active={activePicker === 'palette'}
          />
          <Tab
            label={t('grafana-ui.color-picker-popover.spectrum-tab', 'Custom')}
            onChangeTab={onTabChange('spectrum')}
            active={activePicker === 'spectrum'}
          />
          {renderCustomPickerTabs()}
        </TabsBar>
        <div className={styles.colorPickerPopoverContent}>{renderPicker()}</div>
      </div>
    </FocusScope>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
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
};
