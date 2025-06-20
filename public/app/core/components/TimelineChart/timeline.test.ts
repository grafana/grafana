import uPlot from 'uplot';

import { getDefaultTimeRange, createTheme } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';

import { getConfig, TimelineCoreOptions, shouldDrawYValue } from './timeline';
import { TimelineMode } from './utils';

jest.mock('uplot');

describe('StateTimeline uPlot integration', () => {
  const buildTestCoreOptions = (opts: Partial<TimelineCoreOptions> = {}): TimelineCoreOptions => ({
    mode: TimelineMode.Changes,
    numSeries: 1,
    theme: createTheme(),
    showValue: VisibilityMode.Always,
    isDiscrete: jest.fn(() => true),
    hasMappedNull: jest.fn(() => false),
    hasMappedNaN: jest.fn(() => false),
    getValueColor: jest.fn(() => '#fff'),
    label: jest.fn(() => 'foo'),
    getTimeRange: jest.fn(() => getDefaultTimeRange()),
    getFieldConfig: jest.fn(() => ({})),
    hoverMulti: false,
    ...opts,
  });

  const buildMockUplotInstance = (
    data: Array<Array<null | number>> = [
      [0, 0, 0],
      [0, 1, 2],
    ]
  ) =>
    ({
      ctx: {
        save: jest.fn(),
        restore: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
        font: '',
        fill: jest.fn(),
        fillStyle: '',
        fillText: jest.fn(),
        measureText: jest.fn(() => ({ width: 0 })),
        beginPath: jest.fn(),
      },
      root: document.createElement('div'),
      bbox: { left: 0, top: 0, width: 100, height: 100 },
      data,
      cursor: { left: 0, top: 0 },
      series: [{}],
      scales: {},
      opts: {},
      pxRatio: 1,
      posToVal: jest.fn(),
      valToPos: jest.fn(),
    }) as unknown as uPlot;

  const callOrientCallback = (mockUplot: uPlot) => {
    const orientCallback = jest.mocked(uPlot.orient).mock.calls[jest.mocked(uPlot.orient).mock.calls.length - 1][2];
    const methods = {
      moveTo: jest.fn(() => {}),
      lineTo: jest.fn(() => {}),
      rect: jest.fn(() => {}),
      arc: jest.fn(() => {}),
      bezierCurveTo: jest.fn(() => {}),
    };

    orientCallback(
      mockUplot.series[0],
      mockUplot.data[0] as number[],
      mockUplot.data[1] as number[],
      mockUplot.scales.x,
      mockUplot.scales.y,
      jest.fn(() => 1),
      jest.fn(() => 1),
      0,
      0,
      100,
      100,
      methods.moveTo,
      methods.lineTo,
      methods.rect,
      methods.arc,
      methods.bezierCurveTo
    );

    return methods;
  };

  describe('#drawPoints', () => {
    it('returns a `drawPoints` method when a `formatValue` function is provided', () => {
      const config = getConfig(buildTestCoreOptions({ formatValue: () => 'foo' }));
      expect(typeof config.drawPoints).toBe('function');
    });

    it('returns false for `drawPoints` when no `formatValue` function is provided', () => {
      const config = getConfig(buildTestCoreOptions());
      expect(config.drawPoints).toBe(false);
    });

    it('returns false for `drawPoints` if the visibility mode is `never`', () => {
      const config = getConfig(buildTestCoreOptions({ formatValue: () => 'foo', showValue: VisibilityMode.Never }));
      expect(config.drawPoints).toBe(false);
    });

    it('returns a function for `drawPoints` if the conditions are met', () => {
      const { drawPoints } = getConfig(buildTestCoreOptions({ formatValue: () => 'foo' }));
      if (!drawPoints) {
        throw new Error('drawPoints is not defined');
      }
      const mockUplot = buildMockUplotInstance();
      expect(drawPoints(mockUplot, 1, 2, 3, null)).toBe(false);
      expect(uPlot.orient).toHaveBeenCalledWith(mockUplot, 1, expect.any(Function));
    });

    describe('#drawPaths', () => {
      describe('null and NaN values', () => {
        // these tests are attempting to determine whether `shouldDrawYVal` is returning false
        // and preventing a draw for a given value. this is being done by checking the number of
        // calls to `rect` by the `orient` callback created by a `drawPaths` call.

        it('should draw boxes for null values when hasMappedNull returns true and isDiscrete returns true', () => {
          const { drawClear, drawPaths } = getConfig(
            buildTestCoreOptions({
              hasMappedNull: jest.fn(() => true),
              isDiscrete: jest.fn(() => true),
              formatValue: () => 'foo',
            })
          );
          const mockUplot = buildMockUplotInstance([[0], [null]]);

          drawClear(mockUplot);
          drawPaths(mockUplot, 1, 0, 1);

          const { rect } = callOrientCallback(mockUplot);
          expect(rect).toHaveBeenCalledTimes(2);
        });

        it('should not draw boxes for null values when hasMappedNull returns false and isDiscrete returns true', () => {
          const { drawClear, drawPaths } = getConfig(
            buildTestCoreOptions({
              hasMappedNull: jest.fn(() => false),
              isDiscrete: jest.fn(() => true),
              formatValue: () => 'foo',
            })
          );
          const mockUplot = buildMockUplotInstance([[0], [null]]);

          drawClear(mockUplot);
          drawPaths(mockUplot, 1, 0, 1);

          const { rect } = callOrientCallback(mockUplot);
          expect(rect).toHaveBeenCalledTimes(1);
        });

        it('should draw boxes for NaN values when hasMappedNaN returns true and isDiscrete returns true', () => {
          const { drawClear, drawPaths } = getConfig(
            buildTestCoreOptions({
              hasMappedNaN: jest.fn(() => true),
              isDiscrete: jest.fn(() => true),
              formatValue: () => 'foo',
            })
          );
          const mockUplot = buildMockUplotInstance([[0], [NaN]]);

          drawClear(mockUplot);
          drawPaths(mockUplot, 1, 0, 1);

          const { rect } = callOrientCallback(mockUplot);
          expect(rect).toHaveBeenCalledTimes(2);
        });

        it('should not draw boxes for NaN values when hasMappedNaN returns false and isDiscrete returns true', () => {
          const { drawClear, drawPaths } = getConfig(
            buildTestCoreOptions({
              hasMappedNaN: jest.fn(() => false),
              isDiscrete: jest.fn(() => true),
              formatValue: () => 'foo',
            })
          );
          const mockUplot = buildMockUplotInstance([[0], [NaN]]);

          drawClear(mockUplot);
          drawPaths(mockUplot, 1, 0, 1);

          const { rect } = callOrientCallback(mockUplot);
          expect(rect).toHaveBeenCalledTimes(1);
        });

        it('should not draw boxes for NaN or null values when isDiscrete returns false', () => {
          const { drawClear, drawPaths } = getConfig(
            buildTestCoreOptions({
              hasMappedNaN: jest.fn(() => true),
              hasMappedNull: jest.fn(() => true),
              isDiscrete: jest.fn(() => false),
              formatValue: () => 'foo',
            })
          );
          const mockUplot = buildMockUplotInstance([[0], [NaN, null]]);

          drawClear(mockUplot);
          drawPaths(mockUplot, 1, 0, 1);

          const { rect } = callOrientCallback(mockUplot);
          expect(rect).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('#shouldDrawYValue', () => {
    describe.each([
      [true, undefined, undefined, true, 'boolean true returns true'],
      [false, undefined, undefined, true, 'boolean false returns true'],
    ])('boolean values', (yValue, mappedNull, mappedNaN, expected, testName) => {
      it(testName, () => {
        expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
      });
    });

    describe.each([
      [0, undefined, undefined, true, 'zero returns true'],
      [1, undefined, undefined, true, 'positive integer returns true'],
      [-2.71, undefined, undefined, true, 'negative float returns true'],
      [Number.MAX_VALUE, undefined, undefined, true, 'max value returns true'],
      [Number.MIN_VALUE, undefined, undefined, true, 'min value returns true'],
    ])('finite numeric values', (yValue, mappedNull, mappedNaN, expected, testName) => {
      it(testName, () => {
        expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
      });
    });

    describe.each([
      [Infinity, undefined, undefined, true, 'positive infinity returns true'],
      [-Infinity, undefined, undefined, true, 'negative infinity returns true'],
      [Number.POSITIVE_INFINITY, undefined, undefined, true, 'Number.POSITIVE_INFINITY returns true'],
      [Number.NEGATIVE_INFINITY, undefined, undefined, true, 'Number.NEGATIVE_INFINITY returns true'],
    ])('non-finite numeric values', (yValue, mappedNull, mappedNaN, expected, testName) => {
      it(testName, () => {
        expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
      });
    });

    describe.each([
      [null, undefined, undefined, false, 'null without mappings returns false'],
      [null, false, true, false, 'null with false mappedNull returns false'],
      [null, true, undefined, true, 'null with ture mappedNull returns true'],
    ])('null values', (yValue, mappedNull, mappedNaN, expected, testName) => {
      it(testName, () => {
        expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
      });
    });

    describe.each([
      [NaN, undefined, undefined, false, 'NaN without mappings returns false'],
      [NaN, true, undefined, false, 'NaN with false mappedNaN returns false'],
      [NaN, undefined, true, true, 'NaN with true mappedNaN returns true'],
    ])('NaN values', (yValue, mappedNull, mappedNaN, expected, testName) => {
      it(testName, () => {
        expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
      });
    });

    describe.each([
      ['', undefined, undefined, true, 'empty string returns true'],
      ['to be or not to be', undefined, undefined, true, 'non-empty string returns true'],
    ])('string values', (yValue, mappedNull, mappedNaN, expected, testName) => {
      it(testName, () => {
        expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
      });
    });

    describe.each([[undefined, undefined, undefined, false, 'undefined returns false']])(
      'falsy values',
      (yValue, mappedNull, mappedNaN, expected, testName) => {
        it(testName, () => {
          expect(shouldDrawYValue(yValue, mappedNull, mappedNaN)).toBe(expected);
        });
      }
    );

    describe('non-supported values', () => {
      it.todo(`TODO: this helper currently returns true for many non-supported truthy values, but should not`);
    });
  });
});
