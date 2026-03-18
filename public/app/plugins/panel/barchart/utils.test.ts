import { assertIsDefined } from 'test/helpers/asserts';

import { createTheme, FieldType } from '@grafana/data';
import { AxisColorMode, AxisPlacement, StackingMode, VisibilityMode, VizOrientation } from '@grafana/schema';

import type { BarsOptions } from './bars';
import * as barsModule from './bars';
import {
  createEmptyFrame,
  createFrameWithAxisConfig,
  createFrameWithColorField,
  createFrameWithMappings,
  createFrameWithMultipleStringFields,
  createFrameWithThresholds,
  createMutableFrame,
  createPreparedBarChartSeries,
  createPrepConfigOpts,
  createStringXFrame,
  createTimeXFrame,
  prepBarChartSeries,
} from './test-helpers';
import { prepConfig } from './utils';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  DefaultTimeZone: 'utc',
}));

describe('BarChart utils', () => {
  describe('preparePlotConfigBuilder', () => {
    it.each([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical])('orientation', (v) => {
      const result = prepConfig(
        createPrepConfigOpts({
          options: { orientation: v },
          series: [createPreparedBarChartSeries()],
          orientation: v,
        })
      ).builder.getConfig();
      expect(result).toMatchSnapshot();
    });

    it.each([VisibilityMode.Always, VisibilityMode.Auto])('value visibility', (v) => {
      expect(
        prepConfig(
          createPrepConfigOpts({
            options: { showValue: v },
            series: [createPreparedBarChartSeries()],
          })
        ).builder.getConfig()
      ).toMatchSnapshot();
    });

    it.each([StackingMode.None, StackingMode.Percent, StackingMode.Normal])('stacking', (v) => {
      expect(
        prepConfig(
          createPrepConfigOpts({
            options: { stacking: v },
            series: [createPreparedBarChartSeries()],
          })
        ).builder.getConfig()
      ).toMatchSnapshot();
    });

    it('uses formatShortValue when xTickLabelMaxLength is set', () => {
      const longLabelFrame = createStringXFrame({
        xValues: ['verylonglabel1', 'verylonglabel2', 'verylonglabel3'],
        values: [10, 20, 30],
      });
      const info = prepBarChartSeries([longLabelFrame]);

      const result = prepConfig(
        createPrepConfigOpts({
          options: {
            orientation: VizOrientation.Vertical,
            xTickLabelMaxLength: 5,
          },
          orientation: VizOrientation.Vertical,
          series: info.series,
        })
      ).builder.getConfig();

      const xAxis = result.axes?.find((a) => a.scale === 'x');
      if (!xAxis || typeof xAxis.values !== 'function') {
        throw new Error('Expected x axis with values function');
      }

      const splits = ['verylonglabel1', 'verylonglabel2', 'verylonglabel3'];
      // Invoke uPlot Axis.Values to verify formatShortValue shortens labels
      const labels = (xAxis.values as (u: unknown, s: unknown[], axisIdx: number) => string[])(null, splits, 0);

      expect(labels).toEqual(['veryl...', 'veryl...', 'veryl...']);
    });

    describe('getConfig spy', () => {
      beforeEach(() => {
        jest.restoreAllMocks();
      });

      it('sets groupWidth to barWidth and barWidth to 1 when single value field and stacking None', () => {
        const { getConfig: originalGetConfig } = jest.requireActual<typeof barsModule>('./bars');
        const captured: { groupWidth: number; barWidth: number } = { groupWidth: 0, barWidth: 0 };
        jest.spyOn(barsModule, 'getConfig').mockImplementation((opts: BarsOptions, theme) => {
          captured.groupWidth = opts.groupWidth;
          captured.barWidth = opts.barWidth;
          return originalGetConfig(opts, theme);
        });

        const singleValueFrame = createStringXFrame();
        const info = prepBarChartSeries([singleValueFrame]);

        prepConfig(
          createPrepConfigOpts({
            options: { barWidth: 0.8, groupWidth: 0.6, stacking: StackingMode.None },
            series: info.series,
            totalSeries: 1,
          })
        ).builder.getConfig();

        expect(captured.groupWidth).toBe(0.8);
        expect(captured.barWidth).toBe(1);
      });

      it('sets getColor when color field is provided', () => {
        const { getConfig: originalGetConfig } = jest.requireActual<typeof barsModule>('./bars');
        const captured: { getColor?: BarsOptions['getColor'] } = {};
        jest.spyOn(barsModule, 'getConfig').mockImplementation((opts: BarsOptions, theme) => {
          captured.getColor = opts.getColor;
          return originalGetConfig(opts, theme);
        });

        const df = createFrameWithColorField();
        const info = prepBarChartSeries([df], { colorFieldName: 'colorVal' });

        prepConfig(
          createPrepConfigOpts({
            color: info.color ?? undefined,
            series: info.series,
            totalSeries: 1,
          })
        ).builder.getConfig();

        const getColor = captured.getColor;
        if (!getColor) {
          throw new Error('Expected getColor to be defined');
        }
        const theme = createTheme();
        const expectedColors = {
          c0: theme.visualization.getColorByName('red'),
          c1: theme.visualization.getColorByName('green'),
          c2: theme.visualization.getColorByName('blue'),
        };
        expect(getColor(1, 0, 10)).toEqual(expectedColors.c0);
        expect(getColor(1, 1, 20)).toEqual(expectedColors.c1);
        expect(getColor(1, 2, 30)).toEqual(expectedColors.c2);
      });

      it('sets getColor from per-bar color when field has thresholds', () => {
        const { getConfig: originalGetConfig } = jest.requireActual<typeof barsModule>('./bars');
        const captured: { getColor?: BarsOptions['getColor'] } = {};
        jest.spyOn(barsModule, 'getConfig').mockImplementation((opts: BarsOptions, theme) => {
          captured.getColor = opts.getColor;
          return originalGetConfig(opts, theme);
        });

        const df = createFrameWithThresholds({ values: [10, 50, 90] });
        const info = prepBarChartSeries([df]);
        prepConfig(
          createPrepConfigOpts({
            series: info.series,
            totalSeries: 1,
          })
        ).builder.getConfig();

        const getColor = captured.getColor;
        if (!getColor) {
          throw new Error('Expected getColor to be defined');
        }
        const c0 = getColor(1, 0, 10);
        const c1 = getColor(1, 1, 50);
        const c2 = getColor(1, 2, 90);
        expect(c0).toEqual('#73BF69');
        expect(c1).toEqual('#FADE2A');
        expect(c2).toEqual('#F2495C');
      });

      it('sets getColor from per-bar color when field has value mappings with colors', () => {
        const { getConfig: originalGetConfig } = jest.requireActual<typeof barsModule>('./bars');
        const captured: { getColor?: BarsOptions['getColor'] } = {};
        jest.spyOn(barsModule, 'getConfig').mockImplementation((opts: BarsOptions, theme) => {
          captured.getColor = opts.getColor;
          return originalGetConfig(opts, theme);
        });

        const df = createFrameWithMappings({ values: [1, 2, 3] });
        const info = prepBarChartSeries([df]);
        prepConfig(
          createPrepConfigOpts({
            series: info.series,
            totalSeries: 1,
          })
        ).builder.getConfig();

        const getColor = captured.getColor;
        if (!getColor) {
          throw new Error('Expected getColor to be defined');
        }
        const c0 = getColor(1, 0, 1);
        const c1 = getColor(1, 1, 2);
        const c2 = getColor(1, 2, 3);
        expect(c0).toEqual('#73BF69');
        expect(c1).toEqual('#FADE2A');
        expect(c2).toEqual('#808080');
      });
    });

    it('calls setPadding when xTickLabelRotation is non-zero', () => {
      const frame = createPreparedBarChartSeries();
      const result = prepConfig(
        createPrepConfigOpts({
          options: {
            xTickLabelRotation: 45,
            xTickLabelMaxLength: 10,
          },
          series: [frame],
        })
      ).builder.getConfig();

      const padding = result.padding;
      expect(padding).toBeDefined();
      if (!padding) {
        throw new Error('Expected padding');
      }
      expect(padding).toHaveLength(4);
      // For positive rotation (45°), paddingRight (index 1) should be > 0 (cos(45°) * textWidth)
      expect(padding[1]).toBeGreaterThan(0);
    });

    it('hides x axis when axisPlacement is Hidden', () => {
      const df = createFrameWithAxisConfig({
        xAxisPlacement: AxisPlacement.Hidden,
      });
      const info = prepBarChartSeries([df]);

      const result = prepConfig(
        createPrepConfigOpts({
          series: info.series,
          totalSeries: 1,
          orientation: VizOrientation.Vertical,
        })
      ).builder.getConfig();

      const xAxis = result.axes?.find((a) => a.scale === 'x');
      expect(xAxis?.show).toBe(false);
    });

    it('swaps axis placement for Horizontal orientation', () => {
      const df = createFrameWithAxisConfig({
        axisPlacement: AxisPlacement.Left,
        axisBorderShow: true,
        axisColorMode: AxisColorMode.Series,
        axisGridShow: true,
      });
      const info = prepBarChartSeries([df]);

      const result = prepConfig(
        createPrepConfigOpts({
          series: info.series,
          totalSeries: 1,
          orientation: VizOrientation.Horizontal,
        })
      ).builder.getConfig();

      const yAxis = result.axes?.find((a) => a.scale === 'short');
      expect(yAxis?.scale).toEqual('short');
      expect(yAxis?.side).toBe(2);
    });

    it('applies axisBorderShow and axisColorMode when set on field', () => {
      const df = createFrameWithAxisConfig({
        axisPlacement: AxisPlacement.Left,
        axisBorderShow: true,
        axisColorMode: AxisColorMode.Series,
        axisGridShow: true,
      });
      const info = prepBarChartSeries([df]);

      const result = prepConfig(
        createPrepConfigOpts({
          series: info.series,
          totalSeries: 1,
          orientation: VizOrientation.Vertical,
        })
      ).builder.getConfig();

      const yAxis = result.axes?.find((a) => a.scale === 'short');
      expect(yAxis?.border?.show).toBe(true);
      expect(typeof yAxis?.stroke).toEqual('string');
      expect(yAxis?.grid?.show).toBe(true);
    });

    it('prepData closure updates internal state and delegates to builder.prepData', () => {
      const frame1 = createPreparedBarChartSeries();
      const { prepData } = prepConfig(
        createPrepConfigOpts({
          series: [frame1],
        })
      );

      expect(typeof prepData).toEqual('function');
      const prepDataFn = prepData;
      if (!prepDataFn) {
        throw new Error('prepData expected');
      }

      const newFrame = createStringXFrame({
        xValues: ['d', 'e', 'f'],
        values: [40, 50, 60],
      });

      const result = prepDataFn([newFrame], null);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      // preparePlotData2 returns [xValues, yValues, ...] for each field; result[0]=x, result[1]=value
      expect(result[0]).toEqual(['d', 'e', 'f']);
      expect(result[1]).toEqual([40, 50, 60]);
    });
  });

  describe('prepareGraphableFrames', () => {
    it('will return empty string when there are no frames in the response', () => {
      const info = prepBarChartSeries([]);

      expect(info.warn).toBe('');
      expect(info.series).toHaveLength(0);
    });

    it('will return empty string when there is no data in the response', () => {
      const info = prepBarChartSeries([createEmptyFrame()]);

      expect(info.warn).toBe('');
      expect(info.series).toHaveLength(0);
    });

    it('will warn when there is no string or time field', () => {
      const df = createMutableFrame([
        { name: 'a', type: FieldType.other, values: [1, 2, 3, 4, 5] },
        { name: 'value', values: [1, 2, 3, 4, 5] },
      ]);

      const info = prepBarChartSeries([df]);
      const warning = assertIsDefined('warn' in info ? info : null);
      expect(warning.warn).toEqual('Bar charts require a string or time field');
    });

    it('will warn when there are no numeric fields in the response', () => {
      const df = createMutableFrame([
        { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
        { name: 'value', type: FieldType.boolean, values: [true, true, true, true, true] },
      ]);

      const info = prepBarChartSeries([df]);
      const warning = assertIsDefined('warn' in info ? info : null);
      expect(warning.warn).toEqual('No numeric fields found');
    });

    it('will convert NaN and Infinty to nulls', () => {
      const df = createMutableFrame([
        { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
        { name: 'value', values: [-10, NaN, 10, -Infinity, +Infinity] },
      ]);

      const info = prepBarChartSeries([df]);

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
      const df = createMutableFrame([
        { name: 'string', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'a', values: [-10, 20, 10], config: {} },
        { name: 'b', values: [20, 20, 20], config: {} },
        { name: 'c', values: [10, 10, 10], config: {} },
      ]);
      df.fields[1].state = { calcs: { min: -10 } };
      df.fields[2].state = { calcs: { min: 20 } };
      df.fields[3].state = { calcs: { min: 10 } };

      const info = prepBarChartSeries([df], { stacking: StackingMode.Percent });

      expect(info.series[0].fields[0].config.unit).toBeUndefined();
      expect(info.series[0].fields[1].config.unit).toBeUndefined();
      expect(info.series[0].fields[2].config.unit).toBeUndefined();
    });

    it('joins multiple frames on time field when frames have time and length > 1', () => {
      const df1 = createTimeXFrame({
        refId: 'A',
        timeValues: [1000, 2000, 3000],
        values: [10, 20, 30],
      });
      const df2 = createTimeXFrame({
        refId: 'B',
        timeValues: [1000, 2000, 4000],
        values: [5, 15, 25],
      });

      const info = prepBarChartSeries([df1, df2]);

      expect(info.series).toHaveLength(1);
      const frame = info.series[0];
      expect(frame.fields[0].type).toBe(FieldType.time);
      expect(frame.length).toEqual(4);
    });

    it('selects x field by xFieldName when provided', () => {
      const df = createFrameWithMultipleStringFields();

      const info = prepBarChartSeries([df], { xFieldName: 'other' });

      expect(info.series[0].fields[0].name).toBe('other');
      expect(info.series[0].fields[1].name).toBe('value');
    });

    it('selects color field by colorFieldName when provided', () => {
      const df = createFrameWithColorField({ colorFieldName: 'colorVal' });

      const info = prepBarChartSeries([df], { colorFieldName: 'colorVal' });

      expect(info.color).not.toBeNull();
      expect(info.color?.name).toBe('colorVal');
    });
  });
});
