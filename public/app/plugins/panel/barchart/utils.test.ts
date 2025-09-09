import { assertIsDefined } from 'test/helpers/asserts';

import {
  createTheme,
  FieldConfig,
  FieldType,
  MutableDataFrame,
  VizOrientation,
  FieldConfigSource,
  createDataFrame,
} from '@grafana/data';
import {
  LegendDisplayMode,
  TooltipDisplayMode,
  VisibilityMode,
  GraphGradientMode,
  StackingMode,
  SortOrder,
  defaultTimeZone,
} from '@grafana/schema';

import { FieldConfig as PanelFieldConfig } from './panelcfg.gen';
import { prepSeries, prepConfig, PrepConfigOpts, getClustersFromField } from './utils';

const fieldConfig: FieldConfigSource = {
  defaults: {},
  overrides: [],
};

function mockDataFrame() {
  const df1 = new MutableDataFrame({
    refId: 'A',
    fields: [{ name: 'ts', type: FieldType.string, values: ['a', 'b', 'c'] }],
  });

  const df2 = new MutableDataFrame({
    refId: 'B',
    fields: [{ name: 'ts', type: FieldType.time, values: [1, 2, 4] }],
  });

  const f1Config: FieldConfig<PanelFieldConfig> = {
    displayName: 'Metric 1',
    decimals: 2,
    unit: 'm/s',
    custom: {
      gradientMode: GraphGradientMode.Opacity,
      lineWidth: 2,
      fillOpacity: 0.1,
    },
  };

  const f2Config: FieldConfig<PanelFieldConfig> = {
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

  df1.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));
  df2.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

  const info = prepSeries([df1], fieldConfig, StackingMode.None, createTheme());

  if (info.series.length === 0) {
    throw new Error('Bar chart not prepared correctly');
  }

  return info.series[0];
}

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  DefaultTimeZone: 'utc',
}));

describe('BarChart utils', () => {
  describe('preparePlotConfigBuilder', () => {
    const config: PrepConfigOpts = {
      series: [mockDataFrame()],
      totalSeries: 2,
      // color?: Field | null;
      timeZone: defaultTimeZone,
      theme: createTheme(),
      orientation: VizOrientation.Auto,

      options: {
        orientation: VizOrientation.Auto,
        clusterWidth: 0.7,
        groupWidth: 20,
        barWidth: 2,
        showValue: VisibilityMode.Always,
        legend: {
          displayMode: LegendDisplayMode.List,
          showLegend: true,
          placement: 'bottom',
          calcs: [],
        },
        xTickLabelRotation: 0,
        xTickLabelMaxLength: 20,
        stacking: StackingMode.None,
        tooltip: {
          mode: TooltipDisplayMode.None,
          sort: SortOrder.None,
        },
        text: {
          valueSize: 10,
        },
        fullHighlight: false,
      },
    };

    it.each([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical])('orientation', (v) => {
      const result = prepConfig({
        ...config,
        options: {
          ...config.options,
          orientation: v,
        },
        series: [mockDataFrame()],
        orientation: v,
      }).builder.getConfig();
      expect(result).toMatchSnapshot();
    });

    it.each([VisibilityMode.Always, VisibilityMode.Auto])('value visibility', (v) => {
      expect(
        prepConfig({
          ...config,
          options: {
            ...config.options,
            showValue: v,
          },
          series: [mockDataFrame()],
        }).builder.getConfig()
      ).toMatchSnapshot();
    });

    it.each([StackingMode.None, StackingMode.Percent, StackingMode.Normal])('stacking', (v) => {
      expect(
        prepConfig({
          ...config,
          options: {
            ...config.options,
            stacking: v,
          },
          series: [mockDataFrame()],
        }).builder.getConfig()
      ).toMatchSnapshot();
    });
  });

  describe('prepareGraphableFrames', () => {
    it('will return empty string when there are no frames in the response', () => {
      const info = prepSeries([], fieldConfig, StackingMode.None, createTheme());

      expect(info.warn).toBe('');
      expect(info.series).toHaveLength(0);
    });

    it('will return empty string when there is no data in the response', () => {
      const info = prepSeries(
        [
          {
            length: 0,
            fields: [],
          },
        ],
        fieldConfig,
        StackingMode.None,
        createTheme()
      );

      expect(info.warn).toBe('');
      expect(info.series).toHaveLength(0);
    });

    it('will warn when there is no string or time field', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.other, values: [1, 2, 3, 4, 5] },
          { name: 'value', values: [1, 2, 3, 4, 5] },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const warning = assertIsDefined('warn' in info ? info : null);
      expect(warning.warn).toEqual('Bar charts require a string or time field');
    });

    it('will warn when there are no numeric fields in the response', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
          { name: 'value', type: FieldType.boolean, values: [true, true, true, true, true] },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const warning = assertIsDefined('warn' in info ? info : null);
      expect(warning.warn).toEqual('No numeric fields found');
    });

    it('will convert NaN and Infinty to nulls', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
          { name: 'value', values: [-10, NaN, 10, -Infinity, +Infinity] },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());

      const field = info.series[0].fields[1];
      expect(field.values).toMatchInlineSnapshot(`
        [
          -10,
          null,
          10,
          null,
          null,
        ]
      `);
    });

    it('should not apply % unit to series when stacking is percent', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'string', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'a', values: [-10, 20, 10], state: { calcs: { min: -10 } } },
          { name: 'b', values: [20, 20, 20], state: { calcs: { min: 20 } } },
          { name: 'c', values: [10, 10, 10], state: { calcs: { min: 10 } } },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.Percent, createTheme());

      expect(info.series[0].fields[0].config.unit).toBeUndefined();
      expect(info.series[0].fields[1].config.unit).toBeUndefined();
      expect(info.series[0].fields[2].config.unit).toBeUndefined();
    });
  });
  describe('getClustersFromField', () => {
    it('should return an empty array when no fields', () => {
      const df = createDataFrame({
        fields: [],
      });
      const info = prepSeries([df], fieldConfig, StackingMode.Percent, createTheme());
      const groupByField = "testField"
      expect(getClustersFromField(info.series, groupByField)).toEqual([]);
    });
    it('should return an empty array when no, empty or invalid groupByField', () => {
      const df = createDataFrame({
        fields: [
          { name: 'station', values: [1,1,2,2]},
          { name: 'type', type: FieldType.string, values: ['actual', 'estimate', 'actual', 'estimate']},
          { name: 'welding', values: [50.0, 55.0, 30.0, 25.0]},
          { name: 'lineup', values: [70.0, 90.0, , ,]},
          { name: 'other', values: [20.0, 15.0, 10.0, 15.0]},
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.Percent, createTheme());
      expect(getClustersFromField(info.series, undefined)).toEqual([]);
      expect(getClustersFromField(info.series, "")).toEqual([]);
      expect(getClustersFromField(info.series, "non-existent")).toEqual([]);
    });
    it('should return correct clusters', () => {
      const df = createDataFrame({
        fields: [
          { name: 'station', values: [1,1,2,2]},
          { name: 'type', type: FieldType.string, values: ['actual', 'estimate', 'actual', 'estimate']},
          { name: 'welding', values: [50.0, 55.0, 30.0, 25.0]},
          { name: 'lineup', values: [70.0, 90.0, , ,]},
          { name: 'other', values: [20.0, 15.0, 10.0, 15.0]},
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));
      const info = prepSeries([df], fieldConfig, StackingMode.Percent, createTheme());
      expect(getClustersFromField(info.series, "station")).toEqual([2,2]);
    });
  });
});


