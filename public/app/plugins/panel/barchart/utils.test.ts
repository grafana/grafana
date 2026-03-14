import { assertIsDefined } from 'test/helpers/asserts';

import {
  createTheme,
  FieldConfig,
  FieldType,
  MutableDataFrame,
  VizOrientation,
  FieldConfigSource,
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

  describe('auto-spacing for time axis labels', () => {
    function makeTimeFrame(timestamps: number[], fieldConfig?: { unit?: string }) {
      const df = new MutableDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: timestamps, config: fieldConfig ?? {} },
          { name: 'value', type: FieldType.number, values: timestamps.map((_, i) => (i + 1) * 10) },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));
      return df;
    }

    function getXAxisFilter(opts: { timestamps?: number[]; xTickLabelSpacing?: number; orientation?: VizOrientation; timeFieldConfig?: { unit?: string }; fieldType?: FieldType }) {
      const isString = opts.fieldType === FieldType.string;
      const df = isString
        ? (() => {
            const d = new MutableDataFrame({
              refId: 'A',
              fields: [
                { name: 'category', type: FieldType.string, values: (opts.timestamps ?? []).map((_, i) => `cat${i}`) },
                { name: 'value', type: FieldType.number, values: (opts.timestamps ?? []).map((_, i) => (i + 1) * 10) },
              ],
            });
            d.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));
            return d;
          })()
        : makeTimeFrame(opts.timestamps ?? [1609459200000, 1609545600000, 1609632000000], opts.timeFieldConfig);

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const result = prepConfig({
        ...config,
        options: { ...config.options, xTickLabelSpacing: opts.xTickLabelSpacing ?? 0 },
        series: info.series,
        orientation: opts.orientation ?? VizOrientation.Auto,
      }).builder.getConfig();

      return result.axes![0].filter as ((self: any, splits: number[]) => (number | null)[]) | undefined;
    }

    // Mock uPlot instance for invoking the filter function directly
    function mockUPlot(data: number[][], bboxWidth: number, bboxHeight: number) {
      return { data, bbox: { width: bboxWidth, height: bboxHeight } };
    }

    it('should produce a filter when xTickLabelSpacing is 0 and field is time without time: unit', () => {
      const filter = getXAxisFilter({});
      expect(filter).toBeDefined();
    });

    it('should not produce a filter when time field has time: unit prefix', () => {
      const filter = getXAxisFilter({ timeFieldConfig: { unit: 'time:YYYY-MM-DD' } });
      expect(filter).toBeUndefined();
    });

    it('should not produce a filter for string fields with xTickLabelSpacing 0', () => {
      const filter = getXAxisFilter({ fieldType: FieldType.string, timestamps: [1, 2, 3] });
      expect(filter).toBeUndefined();
    });

    it('should produce a filter for both horizontal and vertical bar orientations', () => {
      const hFilter = getXAxisFilter({ orientation: VizOrientation.Vertical });
      const vFilter = getXAxisFilter({ orientation: VizOrientation.Horizontal });
      expect(hFilter).toBeDefined();
      expect(vFilter).toBeDefined();
    });

    it('should keep all ticks when chart is wide enough to fit them', () => {
      // 3 daily timestamps — labels are short (e.g. "01/01"), chart is very wide
      const timestamps = [1609459200000, 1609545600000, 1609632000000];
      const filter = getXAxisFilter({ timestamps })!;
      const splits = [0, 1, 2];
      const u = mockUPlot([timestamps], 2000, 400);

      const result = filter(u, splits);
      // All ticks should be kept (no nulls) when there's plenty of space
      expect(result.filter((v) => v !== null)).toHaveLength(3);
    });

    it('should skip ticks when chart is too narrow to fit all labels', () => {
      // Generate many daily timestamps so labels must overlap on a narrow chart
      const dayMs = 24 * 60 * 60 * 1000;
      const start = 1609459200000; // 2021-01-01
      const timestamps = Array.from({ length: 30 }, (_, i) => start + i * dayMs);
      const filter = getXAxisFilter({ timestamps })!;

      const splits = timestamps.map((_, i) => i);
      // 100px is far too narrow for 30 day-level labels
      const u = mockUPlot([timestamps], 100, 400);

      const result = filter(u, splits);
      const keptTicks = result.filter((v) => v !== null);
      // Some ticks must be filtered out
      expect(keptTicks.length).toBeGreaterThan(0);
      expect(keptTicks.length).toBeLessThan(timestamps.length);
    });

    it('should use font-height-based spacing for vertical axis (horizontal bars)', () => {
      // With horizontal bars, the x-axis is vertical — spacing is based on font height not label width.
      // A narrow bbox height should still cause tick skipping with enough data points.
      const dayMs = 24 * 60 * 60 * 1000;
      const start = 1609459200000;
      const timestamps = Array.from({ length: 20 }, (_, i) => start + i * dayMs);
      const filter = getXAxisFilter({ timestamps, orientation: VizOrientation.Horizontal })!;

      const splits = timestamps.map((_, i) => i);
      // Vertical axis: bbox.height is the relevant dimension; make it small
      const u = mockUPlot([timestamps], 400, 80);

      const result = filter(u, splits);
      const keptTicks = result.filter((v) => v !== null);
      expect(keptTicks.length).toBeGreaterThan(0);
      expect(keptTicks.length).toBeLessThan(timestamps.length);
    });

    it('should handle a single data point without error', () => {
      const timestamps = [1609459200000];
      const filter = getXAxisFilter({ timestamps })!;
      const splits = [0];
      const u = mockUPlot([timestamps], 400, 400);

      const result = filter(u, splits);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(0);
    });
  });
});
