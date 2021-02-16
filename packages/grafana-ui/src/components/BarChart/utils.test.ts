import { preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { FieldConfig, FieldType, GrafanaTheme, MutableDataFrame, VizOrientation } from '@grafana/data';
import { BarChartFieldConfig, BarChartOptions, BarStackingMode, BarValueVisibility } from './types';
import { GraphGradientMode } from '../uPlot/config';
import { LegendDisplayMode } from '../VizLegend/types';

function mockDataFrame() {
  const df1 = new MutableDataFrame({
    refId: 'A',
    fields: [{ name: 'ts', type: FieldType.string, values: ['a', 'b', 'c'] }],
  });

  const df2 = new MutableDataFrame({
    refId: 'B',
    fields: [{ name: 'ts', type: FieldType.time, values: [1, 2, 4] }],
  });

  const f1Config: FieldConfig<BarChartFieldConfig> = {
    displayName: 'Metric 1',
    decimals: 2,
    unit: 'm/s',
    custom: {
      gradientMode: GraphGradientMode.Opacity,
      lineWidth: 2,
      fillOpacity: 0.1,
    },
  };

  const f2Config: FieldConfig<BarChartFieldConfig> = {
    displayName: 'Metric 2',
    decimals: 2,
    unit: 'kWh',
    custom: {
      gradientMode: GraphGradientMode.Hue,
      lineWidth: 2,
      fillOpacity: 0.1,
    },
  };

  df1.addField({
    name: 'metric1',
    type: FieldType.number,
    config: f1Config,
    state: {},
  });

  df2.addField({
    name: 'metric2',
    type: FieldType.number,
    config: f2Config,
    state: {},
  });

  return preparePlotFrame([df1, df2]);
}

describe('GraphNG utils', () => {
  describe('preparePlotConfigBuilder', () => {
    const frame = mockDataFrame();

    const config: BarChartOptions = {
      orientation: VizOrientation.Auto,
      groupWidth: 20,
      barWidth: 2,
      showValue: BarValueVisibility.Always,
      legend: {
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
      stacking: BarStackingMode.None,
    };

    it.each([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical])('orientation', (v) => {
      expect(
        preparePlotConfigBuilder(frame!, { colors: { panelBg: '#000000' } } as GrafanaTheme, {
          ...config,
          orientation: v,
        })
      ).toMatchSnapshot();
    });

    it.each([BarValueVisibility.Always, BarValueVisibility.Auto])('value visibility', (v) => {
      expect(
        preparePlotConfigBuilder(frame!, { colors: { panelBg: '#000000' } } as GrafanaTheme, {
          ...config,
          showValue: v,
        })
      ).toMatchSnapshot();
    });

    it.each([BarStackingMode.None, BarStackingMode.Percent, BarStackingMode.Standard])('stacking', (v) => {
      expect(
        preparePlotConfigBuilder(frame!, { colors: { panelBg: '#000000' } } as GrafanaTheme, {
          ...config,
          stacking: v,
        })
      ).toMatchSnapshot();
    });
  });
});
