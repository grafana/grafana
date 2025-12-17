import { defaultsDeep } from 'lodash';

import { createTheme, FALLBACK_COLOR, Field, FieldDisplay, FieldType, ThresholdsMode } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import {
  buildGradientColors,
  colorAtGradientPercent,
  getBarEndcapColors,
  getEndpointMarkerColors,
  getGradientCss,
} from './colors';

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

describe('RadialGauge color utils', () => {
  describe('buildGradientColors', () => {
    const createField = (colorMode: FieldColorModeId): Field =>
      ({
        type: FieldType.number,
        name: 'Test Field',
        config: {
          color: {
            mode: colorMode,
          },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 50, color: 'yellow' },
              { value: 80, color: 'red' },
            ],
          },
        },
        values: [70, 40, 30, 90, 55],
      }) satisfies Field;

    const buildFieldDisplay = (field: Field, part = {}): FieldDisplay =>
      defaultsDeep(part, {
        field: field.config,
        colIndex: 0,
        view: {
          getFieldDisplayProcessor: jest.fn(() => jest.fn(() => ({ color: undefined }))),
        },
        display: {
          numeric: 75,
        },
      });

    it('should return the baseColor if gradient is false-y', () => {
      expect(
        buildGradientColors(false, createTheme(), buildFieldDisplay(createField(FieldColorModeId.Fixed)), '#FF0000')
      ).toEqual([
        { color: '#FF0000', percent: 0 },
        { color: '#FF0000', percent: 1 },
      ]);

      expect(
        buildGradientColors(undefined, createTheme(), buildFieldDisplay(createField(FieldColorModeId.Fixed)), '#FF0000')
      ).toEqual([
        { color: '#FF0000', percent: 0 },
        { color: '#FF0000', percent: 1 },
      ]);
    });

    it('uses the fallback color if no baseColor is set', () => {
      expect(buildGradientColors(false, createTheme(), buildFieldDisplay(createField(FieldColorModeId.Fixed)))).toEqual(
        [
          { color: FALLBACK_COLOR, percent: 0 },
          { color: FALLBACK_COLOR, percent: 1 },
        ]
      );
    });

    it('should map threshold colors correctly (with baseColor if displayProcessor does not return colors)', () => {
      expect(
        buildGradientColors(
          true,
          createTheme(),
          buildFieldDisplay(createField(FieldColorModeId.Thresholds), {
            view: { getFieldDisplayProcessor: jest.fn(() => jest.fn(() => ({ color: '#444444' }))) },
          })
        )
      ).toMatchSnapshot();
    });

    it('should map threshold colors correctly (with baseColor if displayProcessor does not return colors)', () => {
      expect(
        buildGradientColors(true, createTheme(), buildFieldDisplay(createField(FieldColorModeId.Thresholds)), '#FF0000')
      ).toMatchSnapshot();
    });

    it('should return gradient colors for continuous color modes', () => {
      expect(
        buildGradientColors(
          true,
          createTheme(),
          buildFieldDisplay(createField(FieldColorModeId.ContinuousCividis)),
          '#00FF00'
        )
      ).toMatchSnapshot();
    });

    it.each(['dark', 'light'] as const)('should return gradient colors for by-value color mode in %s theme', (mode) => {
      expect(
        buildGradientColors(
          true,
          createTheme({ colors: { mode } }),
          buildFieldDisplay(createField(FieldColorModeId.ContinuousBlues))
        )
      ).toMatchSnapshot();
    });

    it.each(['dark', 'light'] as const)('should return gradient colors for fixed color mode in %s theme', (mode) => {
      expect(
        buildGradientColors(
          true,
          createTheme({ colors: { mode } }),
          buildFieldDisplay(createField(FieldColorModeId.Fixed)),
          '#442299'
        )
      ).toMatchSnapshot();
    });
  });

  describe('colorAtGradientPercent', () => {
    it('should calculate the color at a given percent in a gradient of two colors', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#0000ff', percent: 1 },
      ];
      expect(colorAtGradientPercent(gradient, 0).toHexString()).toBe('#ff0000');
      expect(colorAtGradientPercent(gradient, 0.25).toHexString()).toBe('#bf0040');
      expect(colorAtGradientPercent(gradient, 0.5).toHexString()).toBe('#800080');
      expect(colorAtGradientPercent(gradient, 0.75).toHexString()).toBe('#4000bf');
      expect(colorAtGradientPercent(gradient, 1).toHexString()).toBe('#0000ff');
    });

    it('should calculate the color at a given percent in a gradient of multiple colors', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#00ff00', percent: 0.5 },
        { color: '#0000ff', percent: 1 },
      ];
      expect(colorAtGradientPercent(gradient, 0).toHexString()).toBe('#ff0000');
      expect(colorAtGradientPercent(gradient, 0.25).toHexString()).toBe('#808000');
      expect(colorAtGradientPercent(gradient, 0.5).toHexString()).toBe('#00ff00');
      expect(colorAtGradientPercent(gradient, 0.75).toHexString()).toBe('#008080');
      expect(colorAtGradientPercent(gradient, 1).toHexString()).toBe('#0000ff');
    });

    it('will still work if unsorted', () => {
      const gradient = [
        { color: '#0000ff', percent: 1 },
        { color: '#00ff00', percent: 0.5 },
        { color: '#ff0000', percent: 0 },
      ];
      expect(colorAtGradientPercent(gradient, 0).toHexString()).toBe('#ff0000');
      expect(colorAtGradientPercent(gradient, 0.25).toHexString()).toBe('#808000');
      expect(colorAtGradientPercent(gradient, 0.5).toHexString()).toBe('#00ff00');
      expect(colorAtGradientPercent(gradient, 0.75).toHexString()).toBe('#008080');
      expect(colorAtGradientPercent(gradient, 1).toHexString()).toBe('#0000ff');
    });

    it('should not throw an error when percent is outside 0-1 range', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#0000ff', percent: 1 },
      ];
      expect(colorAtGradientPercent(gradient, -0.5).toHexString()).toBe('#ff0000');
      expect(colorAtGradientPercent(gradient, 1.5).toHexString()).toBe('#0000ff');
    });

    it('should throw an error when less than two stops are provided', () => {
      expect(() => {
        colorAtGradientPercent([], 0.5);
      }).toThrow('colorAtGradientPercent requires at least two color stops');
      expect(() => {
        colorAtGradientPercent([{ color: '#ff0000', percent: 0 }], 0.5);
      }).toThrow('colorAtGradientPercent requires at least two color stops');
    });
  });

  describe('getBarEndcapColors', () => {
    it('should return the first and last colors in the gradient', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#00ff00', percent: 0.5 },
        { color: '#0000ff', percent: 1 },
      ];
      const [startColor, endColor] = getBarEndcapColors(gradient);
      expect(startColor).toBe('#ff0000');
      expect(endColor).toBe('#0000ff');
    });

    it('should return the correct end color based on percent', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#00ff00', percent: 0.5 },
        { color: '#0000ff', percent: 1 },
      ];
      const [startColor, endColor] = getBarEndcapColors(gradient, 0.25);
      expect(startColor).toBe('#ff0000');
      expect(endColor).toBe('#808000');
    });

    it('should handle gradients with only one colors', () => {
      const gradient = [{ color: '#ff0000', percent: 0 }];
      const [startColor, endColor] = getBarEndcapColors(gradient);
      expect(startColor).toBe('#ff0000');
      expect(endColor).toBe('#ff0000');
    });

    it('should throw an error when no colors are provided', () => {
      expect(() => {
        getBarEndcapColors([]);
      }).toThrow('getBarEndcapColors requires at least one color stop');
    });
  });

  describe('getGradientCss', () => {
    it('should return conic-gradient CSS for circle shape', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#00ff00', percent: 0.5 },
        { color: '#0000ff', percent: 1 },
      ];
      const css = getGradientCss(gradient, 'circle');
      expect(css).toBe('conic-gradient(from 0deg, #ff0000 0.00%, #00ff00 50.00%, #0000ff 100.00%)');
    });

    it('should return linear-gradient CSS for arc shape', () => {
      const gradient = [
        { color: '#ff0000', percent: 0 },
        { color: '#00ff00', percent: 0.5 },
        { color: '#0000ff', percent: 1 },
      ];
      const css = getGradientCss(gradient, 'gauge');
      expect(css).toBe('linear-gradient(90deg, #ff0000 0.00%, #00ff00 50.00%, #0000ff 100.00%)');
    });
  });

  describe('getEndpointMarkerColors', () => {
    it('should return contrasting guide dot colors based on the gradient endpoints and percent', () => {
      const gradient = [
        { color: '#000000', percent: 0 },
        { color: '#ffffff', percent: 0.5 },
        { color: '#ffffff', percent: 1 },
      ];
      const [startDotColor, endDotColor] = getEndpointMarkerColors(gradient, 0.35);
      expect(startDotColor).toBe('#fbfbfb');
      expect(endDotColor).toBe('#111217');
    });
  });
});
