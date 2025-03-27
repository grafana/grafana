import { CSSProperties } from 'react';

import { createTheme, FieldType } from '@grafana/data';
import { PercentChangeColorMode } from '@grafana/schema';

import { Props, BigValueColorMode, BigValueGraphMode, BigValueTextMode } from './BigValue';
import {
  buildLayout,
  getPercentChangeColor,
  StackedWithChartLayout,
  StackedWithNoChartLayout,
  WideWithChartLayout,
} from './BigValueLayout';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueGraphMode.Area,
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    sparkline: {
      y: {
        name: '',
        values: [1, 2, 3, 4, 3],
        type: FieldType.number,
        config: {},
      },
    },
    count: 1,
    theme: createTheme(),
  };

  Object.assign(props, propOverrides);
  return props;
}

const valueStyles: CSSProperties = {
  color: 'purple',
};

describe('BigValueLayout', () => {
  describe('buildLayout', () => {
    it('should auto select to stacked layout', () => {
      const layout = buildLayout(
        getProps({
          width: 300,
          height: 300,
        })
      );
      expect(layout).toBeInstanceOf(StackedWithChartLayout);
    });

    it('should not include title height when count is 1 and title is auto hidden', () => {
      const layout = buildLayout(
        getProps({
          value: {
            text: '25',
            title: '10',
            numeric: 25,
          },
          sparkline: undefined,
          textMode: BigValueTextMode.Auto,
          count: 1,
        })
      );
      expect(layout.titleFontSize).toBe(0);
    });

    it('should not use chart layout if only one sparkline point', () => {
      const layout = buildLayout(
        getProps({
          value: {
            text: '25',
            title: '10',
            numeric: 25,
          },
          sparkline: {
            y: {
              name: '',
              values: [1],
              type: FieldType.number,
              config: {},
            },
          },
        })
      );
      expect(layout).toBeInstanceOf(StackedWithNoChartLayout);
    });

    it('should auto select to wide layout', () => {
      const layout = buildLayout(
        getProps({
          width: 300,
          height: 100,
        })
      );
      expect(layout).toBeInstanceOf(WideWithChartLayout);
    });
  });

  describe('percentChangeColor', () => {
    const theme = createTheme();
    const themeVisualizationColors = theme.visualization;
    const red = themeVisualizationColors.getColorByName('red');
    const green = themeVisualizationColors.getColorByName('green');
    it('standard negative should be red', () => {
      const percentChange = -10;
      const color = getPercentChangeColor(
        percentChange,
        PercentChangeColorMode.Standard,
        valueStyles,
        themeVisualizationColors
      );
      expect(color).toBe(red);
    });
    it('standard positive should be green', () => {
      const percentChange = 10;
      const color = getPercentChangeColor(
        percentChange,
        PercentChangeColorMode.Standard,
        valueStyles,
        themeVisualizationColors
      );
      expect(color).toBe(green);
    });
    it('inverted negative should be green', () => {
      const percentChange = -10;
      const color = getPercentChangeColor(
        percentChange,
        PercentChangeColorMode.Inverted,
        valueStyles,
        themeVisualizationColors
      );
      expect(color).toBe(green);
    });
    it('inverted positive should be red', () => {
      const percentChange = 10;
      const color = getPercentChangeColor(
        percentChange,
        PercentChangeColorMode.Inverted,
        valueStyles,
        themeVisualizationColors
      );
      expect(color).toBe(red);
    });
    it('same as value negative should be purple', () => {
      const percentChange = -10;
      const color = getPercentChangeColor(
        percentChange,
        PercentChangeColorMode.SameAsValue,
        valueStyles,
        themeVisualizationColors
      );
      expect(color).toBe('purple');
    });
    it('same as value positive should be purple', () => {
      const percentChange = 10;
      const color = getPercentChangeColor(
        percentChange,
        PercentChangeColorMode.SameAsValue,
        valueStyles,
        themeVisualizationColors
      );
      expect(color).toBe('purple');
    });
  });
});
