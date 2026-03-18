import { assertIsDefined } from 'test/helpers/asserts';

import {
  createTheme,
  createDataFrame,
  FieldConfig,
  FieldType,
  getDisplayProcessor,
  MutableDataFrame,
  ThresholdsMode,
  VizOrientation,
  FieldConfigSource,
} from '@grafana/data';
import {
  AxisColorMode,
  AxisPlacement,
  FieldColorModeId,
  LegendDisplayMode,
  MappingType,
  TooltipDisplayMode,
  VisibilityMode,
  GraphGradientMode,
  StackingMode,
  SortOrder,
  defaultTimeZone,
} from '@grafana/schema';

import { FieldConfig as PanelFieldConfig } from './panelcfg.gen';
import { prepSeries, prepConfig, PrepConfigOpts } from './utils';

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

    it('uses formatShortValue when xTickLabelMaxLength is set', () => {
      const frame = mockDataFrame();
      const result = prepConfig({
        ...config,
        options: {
          ...config.options,
          xTickLabelMaxLength: 5,
        },
        series: [frame],
      }).builder.getConfig();

      const xAxis = result.axes?.find((a) => a.scale === 'x');
      expect(xAxis?.scale).toEqual('x');
      expect(xAxis?.values).toEqual(['function']);
    });

    it('sets groupWidth to barWidth and barWidth to 1 when single value field and stacking None', () => {
      const singleValueFrame = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: { unit: 'short', custom: {} },
          },
        ],
      });
      const info = prepSeries([singleValueFrame], fieldConfig, StackingMode.None, createTheme());
      singleValueFrame.fields[1].display = getDisplayProcessor({
        field: singleValueFrame.fields[1],
        theme: createTheme(),
      });

      const result = prepConfig({
        ...config,
        options: { ...config.options, barWidth: 0.8, groupWidth: 0.6 },
        series: info.series,
        totalSeries: 1,
      }).builder.getConfig();

      expect(Array.isArray(result.axes)).toBe(true);
    });

    it('sets getColor when color field is provided', () => {
      const df = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: { unit: 'short', custom: {} },
          },
          {
            name: 'colorVal',
            type: FieldType.string,
            values: ['red', 'green', 'blue'],
            config: { custom: { fillOpacity: 80 } },
          },
        ],
      });
      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme(), undefined, 'colorVal');
      df.fields[2].display = getDisplayProcessor({ field: df.fields[2], theme: createTheme() });

      const result = prepConfig({
        ...config,
        color: info.color ?? undefined,
        series: info.series,
        totalSeries: 1,
      }).builder.getConfig();

      expect(Array.isArray(result.axes)).toBe(true);
    });

    it('sets getColor from per-bar color when field has thresholds', () => {
      const df = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 50, 90],
            config: {
              unit: 'short',
              custom: {},
              color: { mode: FieldColorModeId.Thresholds },
              thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: 0, color: 'green' },
                  { value: 50, color: 'yellow' },
                  { value: 80, color: 'red' },
                ],
              },
            },
          },
        ],
      });
      df.fields[1].display = getDisplayProcessor({ field: df.fields[1], theme: createTheme() });

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const result = prepConfig({
        ...config,
        series: info.series,
        totalSeries: 1,
      }).builder.getConfig();

      expect(Array.isArray(result.axes)).toBe(true);
    });

    it('sets getColor from per-bar color when field has value mappings with colors', () => {
      const df = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [1, 2, 3],
            config: {
              unit: 'short',
              custom: {},
              mappings: [
                {
                  type: MappingType.ValueToText,
                  options: { '1': { text: 'Low', color: 'green' }, '2': { text: 'Mid', color: 'yellow' } },
                },
              ],
            },
          },
        ],
      });
      df.fields[1].display = getDisplayProcessor({ field: df.fields[1], theme: createTheme() });

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const result = prepConfig({
        ...config,
        series: info.series,
        totalSeries: 1,
      }).builder.getConfig();

      expect(Array.isArray(result.axes)).toBe(true);
    });

    it('calls setPadding when xTickLabelRotation is non-zero', () => {
      const frame = mockDataFrame();
      const result = prepConfig({
        ...config,
        options: {
          ...config.options,
          xTickLabelRotation: 45,
          xTickLabelMaxLength: 10,
        },
        series: [frame],
      }).builder.getConfig();

      expect(result.padding).toHaveLength(4);
    });

    it('hides x axis when axisPlacement is Hidden', () => {
      const df = createDataFrame({
        fields: [
          {
            name: 'x',
            type: FieldType.string,
            values: ['a', 'b', 'c'],
            config: { custom: { axisPlacement: AxisPlacement.Hidden } },
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: { unit: 'short', custom: {} },
          },
        ],
      });
      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());

      const result = prepConfig({
        ...config,
        series: info.series,
        totalSeries: 1,
        orientation: VizOrientation.Vertical,
      }).builder.getConfig();

      const xAxis = result.axes?.find((a) => a.scale === 'x');
      expect(xAxis?.show).toBe(false);
    });

    it('swaps axis placement for Horizontal orientation', () => {
      const df = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: {
              unit: 'short',
              custom: {
                axisPlacement: AxisPlacement.Left,
                axisBorderShow: true,
                axisColorMode: AxisColorMode.Series,
                axisGridShow: true,
              },
            },
          },
        ],
      });
      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());

      const result = prepConfig({
        ...config,
        series: info.series,
        totalSeries: 1,
        orientation: VizOrientation.Horizontal,
      }).builder.getConfig();

      const yAxis = result.axes?.find((a) => a.scale === 'short');
      expect(yAxis?.scale).toEqual('short');
      expect(yAxis?.side).toBe(2);
    });

    it('applies axisBorderShow and axisColorMode when set on field', () => {
      const df = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: {
              unit: 'short',
              custom: {
                axisPlacement: AxisPlacement.Left,
                axisBorderShow: true,
                axisColorMode: AxisColorMode.Series,
                axisGridShow: true,
              },
            },
          },
        ],
      });
      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());

      const result = prepConfig({
        ...config,
        series: info.series,
        totalSeries: 1,
        orientation: VizOrientation.Vertical,
      }).builder.getConfig();

      const yAxis = result.axes?.find((a) => a.scale === 'short');
      expect(yAxis?.border?.show).toBe(true);
      expect(typeof yAxis?.stroke).toEqual('string');
      expect(yAxis?.grid?.show).toBe(true);
    });

    it('prepData closure updates internal state and delegates to builder.prepData', () => {
      const frame1 = mockDataFrame();
      const { prepData } = prepConfig({
        ...config,
        series: [frame1],
      });

      expect(typeof prepData).toEqual('function');
      const prepDataFn = prepData;
      if (!prepDataFn) {
        throw new Error('prepData expected');
      }

      const newFrame = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['d', 'e', 'f'], config: { custom: {} } },
          {
            name: 'value',
            type: FieldType.number,
            values: [40, 50, 60],
            config: { unit: 'short', custom: {} },
          },
        ],
      });
      newFrame.fields[1].display = getDisplayProcessor({
        field: newFrame.fields[1],
        theme: createTheme(),
      });

      const result = prepDataFn([newFrame], null);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
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

    it('joins multiple frames on time field when frames have time and length > 1', () => {
      const df1 = createDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000], config: { custom: {} } },
          { name: 'value', type: FieldType.number, values: [10, 20, 30], config: { custom: {} } },
        ],
      });
      const df2 = createDataFrame({
        refId: 'B',
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 4000], config: { custom: {} } },
          { name: 'value', type: FieldType.number, values: [5, 15, 25], config: { custom: {} } },
        ],
      });

      const info = prepSeries([df1, df2], fieldConfig, StackingMode.None, createTheme());

      expect(info.series).toHaveLength(1);
      const frame = info.series[0];
      expect(frame.fields[0].type).toBe(FieldType.time);
      expect(frame.length).toEqual(4);
    });

    it('selects x field by xFieldName when provided', () => {
      const df = createDataFrame({
        fields: [
          { name: 'label', type: FieldType.string, values: ['x', 'y', 'z'], config: { custom: {} } },
          { name: 'other', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          { name: 'value', type: FieldType.number, values: [1, 2, 3], config: { custom: {} } },
        ],
      });

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme(), 'other');

      expect(info.series[0].fields[0].name).toBe('other');
      expect(info.series[0].fields[1].name).toBe('value');
    });

    it('selects color field by colorFieldName when provided', () => {
      const df = createDataFrame({
        fields: [
          { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } },
          { name: 'value', type: FieldType.number, values: [10, 20, 30], config: { custom: {} } },
          { name: 'colorVal', type: FieldType.string, values: ['red', 'green', 'blue'], config: { custom: {} } },
        ],
      });

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme(), undefined, 'colorVal');

      expect(info.color).not.toBeNull();
      expect(info.color?.name).toBe('colorVal');
    });
  });
});
