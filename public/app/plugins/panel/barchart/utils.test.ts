import { prepareGraphableFrames, preparePlotConfigBuilder, preparePlotFrame } from './utils';
import {
  LegendDisplayMode,
  TooltipDisplayMode,
  VisibilityMode,
  GraphGradientMode,
  StackingMode,
} from '@grafana/schema';
import {
  createTheme,
  DefaultTimeZone,
  EventBusSrv,
  FieldConfig,
  FieldType,
  getDefaultTimeRange,
  MutableDataFrame,
  VizOrientation,
} from '@grafana/data';
import { BarChartFieldConfig, BarChartOptions } from './types';

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

jest.mock('@grafana/data', () => ({
  ...(jest.requireActual('@grafana/data') as any),
  DefaultTimeZone: 'utc',
}));

describe('BarChart utils', () => {
  describe('preparePlotConfigBuilder', () => {
    const frame = mockDataFrame();

    const config: BarChartOptions = {
      orientation: VizOrientation.Auto,
      groupWidth: 20,
      barWidth: 2,
      showValue: VisibilityMode.Always,
      legend: {
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        calcs: [],
      },
      xTickLabelRotation: 0,
      xTickLabelMaxLength: 20,
      stacking: StackingMode.None,
      tooltip: {
        mode: TooltipDisplayMode.None,
      },
      text: {
        valueSize: 10,
      },
      rawValue: (seriesIdx: number, valueIdx: number) => frame.fields[seriesIdx].values.get(valueIdx),
    };

    it.each([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical])('orientation', (v) => {
      const result = preparePlotConfigBuilder({
        ...config,
        orientation: v,
        frame: frame!,
        theme: createTheme(),
        timeZone: DefaultTimeZone,
        getTimeRange: getDefaultTimeRange,
        eventBus: new EventBusSrv(),
        allFrames: [frame],
      }).getConfig();
      expect(result).toMatchSnapshot();
    });

    it.each([VisibilityMode.Always, VisibilityMode.Auto])('value visibility', (v) => {
      expect(
        preparePlotConfigBuilder({
          ...config,
          showValue: v,
          frame: frame!,
          theme: createTheme(),
          timeZone: DefaultTimeZone,
          getTimeRange: getDefaultTimeRange,
          eventBus: new EventBusSrv(),
          allFrames: [frame],
        }).getConfig()
      ).toMatchSnapshot();
    });

    it.each([StackingMode.None, StackingMode.Percent, StackingMode.Normal])('stacking', (v) => {
      expect(
        preparePlotConfigBuilder({
          ...config,
          stacking: v,
          frame: frame!,
          theme: createTheme(),
          timeZone: DefaultTimeZone,
          getTimeRange: getDefaultTimeRange,
          eventBus: new EventBusSrv(),
          allFrames: [frame],
        }).getConfig()
      ).toMatchSnapshot();
    });
  });

  describe('prepareGraphableFrames', () => {
    it('will warn when there is no data in the response', () => {
      const result = prepareGraphableFrames([], createTheme(), { stacking: StackingMode.None } as any);
      expect(result.warn).toEqual('No data in response');
    });

    it('will warn when there is no string field in the response', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.time, values: [1, 2, 3, 4, 5] },
          { name: 'value', values: [1, 2, 3, 4, 5] },
        ],
      });
      const result = prepareGraphableFrames([df], createTheme(), { stacking: StackingMode.None } as any);
      expect(result.warn).toEqual('Bar charts requires a string field');
      expect(result.frames).toBeUndefined();
    });

    it('will warn when there are no numeric fields in the response', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
          { name: 'value', type: FieldType.boolean, values: [true, true, true, true, true] },
        ],
      });
      const result = prepareGraphableFrames([df], createTheme(), { stacking: StackingMode.None } as any);
      expect(result.warn).toEqual('No numeric fields found');
      expect(result.frames).toBeUndefined();
    });

    it('will convert NaN and Infinty to nulls', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
          { name: 'value', values: [-10, NaN, 10, -Infinity, +Infinity] },
        ],
      });
      const result = prepareGraphableFrames([df], createTheme(), { stacking: StackingMode.None } as any);

      const field = result.frames![0].fields[1];
      expect(field!.values.toArray()).toMatchInlineSnapshot(`
      Array [
        -10,
        null,
        10,
        null,
        null,
      ]
    `);
    });

    it('should sort fields when legend sortBy and sortDesc are set', () => {
      const frame = new MutableDataFrame({
        fields: [
          { name: 'string', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'a', values: [-10, 20, 10], state: { calcs: { min: -10 } } },
          { name: 'b', values: [20, 20, 20], state: { calcs: { min: 20 } } },
          { name: 'c', values: [10, 10, 10], state: { calcs: { min: 10 } } },
        ],
      });

      const resultAsc = prepareGraphableFrames([frame], createTheme(), {
        legend: { sortBy: 'Min', sortDesc: false },
      } as any);
      expect(resultAsc.frames![0].fields[0].type).toBe(FieldType.string);
      expect(resultAsc.frames![0].fields[1].name).toBe('a');
      expect(resultAsc.frames![0].fields[2].name).toBe('c');
      expect(resultAsc.frames![0].fields[3].name).toBe('b');

      const resultDesc = prepareGraphableFrames([frame], createTheme(), {
        legend: { sortBy: 'Min', sortDesc: true },
      } as any);
      expect(resultDesc.frames![0].fields[0].type).toBe(FieldType.string);
      expect(resultDesc.frames![0].fields[1].name).toBe('b');
      expect(resultDesc.frames![0].fields[2].name).toBe('c');
      expect(resultDesc.frames![0].fields[3].name).toBe('a');
    });
  });
});
