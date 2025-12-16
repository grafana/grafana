import { DataFrameView, FieldDisplay } from '@grafana/data';

import type { RadialGaugeProps } from './RadialGauge';
import { RadialGaugeDimensions } from './types';
import {
  calculateDimensions,
  toRad,
  getValueAngleForValue,
  drawRadialArcPath,
  getFieldConfigMinMax,
  getFieldDisplayProcessor,
  getAngleBetweenSegments,
  getOptimalSegmentCount,
} from './utils';

describe('RadialGauge utils', () => {
  describe('getFieldDisplayProcessor', () => {
    it('should return display processor from view when available', () => {
      const mockProcessor = jest.fn();
      const mockView = {
        getFieldDisplayProcessor: jest.fn().mockReturnValue(mockProcessor),
      } as unknown as DataFrameView;

      const fieldDisplay: FieldDisplay = {
        display: { numeric: 50, text: '50', color: 'blue' },
        field: {},
        view: mockView,
        colIndex: 0,
        rowIndex: 0,
        name: 'test',
        getLinks: () => [],
        hasLinks: false,
      };

      const dp = getFieldDisplayProcessor(fieldDisplay);
      expect(dp).toBe(mockProcessor);
      expect(mockView.getFieldDisplayProcessor).toHaveBeenCalledWith(0);
    });

    it('should return default display processor when view is not available', () => {
      const fieldDisplay: FieldDisplay = {
        display: { numeric: 50, text: '50', color: 'blue' },
        field: {},
        view: undefined,
        colIndex: 0,
        rowIndex: 0,
        name: 'test',
        getLinks: () => [],
        hasLinks: false,
      };

      const dp = getFieldDisplayProcessor(fieldDisplay);
      expect(dp).toBeDefined();
      expect(typeof dp).toBe('function');
    });
  });

  describe('getFieldConfigMinMax', () => {
    it('should return min and max from field config when defined', () => {
      const fieldDisplay: FieldDisplay = {
        display: { numeric: 50, text: '50', color: 'blue' },
        field: { min: 10, max: 90 },
        view: undefined,
        colIndex: 0,
        rowIndex: 0,
        name: 'test',
        getLinks: () => [],
        hasLinks: false,
      };

      const [min, max] = getFieldConfigMinMax(fieldDisplay);
      expect(min).toBe(10);
      expect(max).toBe(90);
    });

    it('should return default min and max when not defined in field config', () => {
      const fieldDisplay: FieldDisplay = {
        display: { numeric: 50, text: '50', color: 'blue' },
        field: {},
        view: undefined,
        colIndex: 0,
        rowIndex: 0,
        name: 'test',
        getLinks: () => [],
        hasLinks: false,
      };

      const [min, max] = getFieldConfigMinMax(fieldDisplay);
      expect(min).toBe(0);
      expect(max).toBe(100);
    });
  });

  describe('calculateDimensions', () => {
    function calc(overrides: Partial<RadialGaugeProps & { barIndex: number }> = {}) {
      return calculateDimensions(
        overrides.width ?? 200,
        overrides.height ?? 200,
        overrides.shape === 'gauge' ? 110 : 360,
        overrides.glowBar ?? false,
        overrides.roundedBars ?? false,
        overrides.barWidthFactor ?? 0.4,
        overrides.barIndex ?? 0,
        overrides.thresholdsBar ?? false,
        overrides.showScaleLabels ?? false
      );
    }

    it('should calculate basic dimensions for a square gauge', () => {
      const result = calc();

      expect(result).toMatchObject({
        centerX: 100, // width / 2
        centerY: 100, // height / 2
        barWidth: expect.closeTo(13.33, 1),
        radius: expect.closeTo(93.33, 1),
        margin: 0, // no glow
        barIndex: 0,
        thresholdsBarWidth: 0,
        thresholdsBarSpacing: 2,
      });
    });

    it('should handle different aspect ratios', () => {
      const wideGauge = calc({ width: 400, height: 200 });
      const tallGauge = calc({ width: 200, height: 400 });

      expect(wideGauge.centerX).toBe(200);
      expect(wideGauge.centerY).toBe(100);
      expect(tallGauge.centerX).toBe(100);
      expect(tallGauge.centerY).toBe(200);
    });

    it('should apply glow margin when glow is enabled', () => {
      const withoutGlow = calc({ width: 200, height: 200 });
      const withGlow = calc({ width: 200, height: 200, glowBar: true });

      expect(withGlow.margin).toBeGreaterThan(0);
      expect(withoutGlow.margin).toBe(0);
      expect(withGlow.radius).toBeLessThan(withoutGlow.radius); // glow reduces available space
    });

    it('should adjust radius for rounded bars when endAngle < 180', () => {
      const sharpBars = calc({});
      const roundedBars = calc({ roundedBars: true });
      const roundedGauge = calc({ roundedBars: true, shape: 'gauge' });

      expect(roundedBars.radius).toEqual(sharpBars.radius);
      expect(roundedGauge.radius).toBeLessThan(sharpBars.radius);
    });

    it('should handle threshold bars', () => {
      const withoutThresholds = calc({ width: 200, height: 200 });
      const withThresholds = calc({ width: 200, height: 200, thresholdsBar: true });

      expect(withThresholds.thresholdsBarWidth).toBe(4);
      expect(withThresholds.radius).toBeLessThan(withoutThresholds.radius);
    });

    it('should adjust radius for multiple bars (barIndex > 0)', () => {
      const firstBar = calc({ width: 200, height: 200, barIndex: 0 });
      const secondBar = calc({ width: 200, height: 200, barIndex: 1 });
      const thirdBar = calc({ width: 200, height: 200, barIndex: 2 });

      expect(secondBar.radius).toBeLessThan(firstBar.radius);
      expect(thirdBar.radius).toBeLessThan(secondBar.radius);
      expect(thirdBar.barIndex).toBe(2);
    });

    it('should handle different barWidthFactors', () => {
      const thinBar = calc({ width: 200, height: 200, barWidthFactor: 0.2, barIndex: 0 });
      const thickBar = calc({ width: 200, height: 200, barWidthFactor: 0.8, barIndex: 0 });

      expect(thickBar.barWidth).toBeGreaterThan(thinBar.barWidth);
      expect(thinBar.radius).toBeGreaterThan(thickBar.radius); // thinner bars leave more space
    });

    it('should enforce minimum bar width', () => {
      const result = calc({ width: 50, height: 50, barWidthFactor: 0.01, barIndex: 0 });
      expect(result.barWidth).toBeGreaterThanOrEqual(2);
    });

    it('should optimize space and position for gauge shape', () => {
      const gauge = calc({ width: 200, height: 200, shape: 'gauge', barIndex: 0 });

      // Different end angles should affect the available space differently
      expect(gauge.radius).toBeCloseTo(93.33, 1);
      expect(gauge.centerY).toBeCloseTo(132.89, 1); // centerY can be much lower when shape is a semi circle
    });

    it('should give space for scale labels', () => {
      const gauge = calc({ width: 200, height: 200, shape: 'gauge', showScaleLabels: true, thresholdsBar: true });

      expect(gauge.radius).toBeCloseTo(72, 1);
      expect(gauge.thresholdsBarRadius).toBeCloseTo(82.66, 1);
      expect(gauge.scaleLabelsFontSize).toBeCloseTo(10, 1);
    });
  });

  describe('toRad', () => {
    it('should convert degrees to radians with -90 degree offset', () => {
      expect(toRad(0)).toBeCloseTo(-Math.PI / 2, 5); // 0° becomes -90° in radians
      expect(toRad(90)).toBeCloseTo(0, 5); // 90° becomes 0° in radians
      expect(toRad(180)).toBeCloseTo(Math.PI / 2, 5); // 180° becomes 90° in radians
      expect(toRad(270)).toBeCloseTo(Math.PI, 5); // 270° becomes 180° in radians
    });

    it('should handle negative angles', () => {
      expect(toRad(-90)).toBeCloseTo(-Math.PI, 5);
    });
  });

  describe('getValueAngleForValue', () => {
    const createFieldDisplay = (value: number, min = 0, max = 100): FieldDisplay => ({
      display: {
        numeric: value,
        text: value.toString(),
        color: 'blue',
      },
      field: {
        min,
        max,
      },
      view: undefined,
      colIndex: 0,
      rowIndex: 0,
      name: 'test',
      getLinks: () => [],
      hasLinks: false,
    });

    it('should calculate angle for value in range', () => {
      const fieldDisplay = createFieldDisplay(50, 0, 100);
      const result = getValueAngleForValue(fieldDisplay, 0, 360);

      expect(result.angle).toBe(180); // 50% of 360°
      expect(result.angleRange).toBe(360);
    });

    it('should handle different start and end angles', () => {
      const fieldDisplay = createFieldDisplay(50, 0, 100);
      const result = getValueAngleForValue(fieldDisplay, 90, 270);

      expect(result.angle).toBe(135); // 50% of 360° range
      expect(result.angleRange).toBe(270);
    });

    it('should clamp angle to maximum range', () => {
      const fieldDisplay = createFieldDisplay(150, 0, 100); // value exceeds max
      const result = getValueAngleForValue(fieldDisplay, 0, 360);

      expect(result.angle).toBe(360); // clamped to angleRange
    });

    it('should handle minimum values', () => {
      const fieldDisplay = createFieldDisplay(0, 0, 100);
      const result = getValueAngleForValue(fieldDisplay, 0, 360);

      expect(result.angle).toBe(0);
    });

    it('should handle maximum values', () => {
      const fieldDisplay = createFieldDisplay(100, 0, 100);
      const result = getValueAngleForValue(fieldDisplay, 0, 360);

      expect(result.angle).toBe(360);
    });

    it('should handle values lower than min', () => {
      const fieldDisplay = createFieldDisplay(-50, 0, 100);
      const result = getValueAngleForValue(fieldDisplay, 240, 120);

      expect(result.angle).toBe(0);
    });

    it('should handle values higher than max', () => {
      const fieldDisplay = createFieldDisplay(200, 0, 100);
      const result = getValueAngleForValue(fieldDisplay, 240, 120);

      // Expect the angle to be clamped to the maximum range
      expect(result.angle).toBe(240);
    });
  });

  describe('drawRadialArcPath', () => {
    const defaultDims: RadialGaugeDimensions = Object.freeze({
      centerX: 100,
      centerY: 100,
      radius: 80,
      barWidth: 20,
      margin: 0,
      barIndex: 0,
      thresholdsBarWidth: 0,
      thresholdsBarSpacing: 0,
      thresholdsBarRadius: 0,
      scaleLabelsFontSize: 0,
      scaleLabelsSpacing: 0,
      scaleLabelsRadius: 0,
      gaugeBottomY: 0,
    });

    it.each([
      { description: 'quarter arc', startAngle: 0, endAngle: 90 },
      { description: 'half arc', startAngle: 0, endAngle: 180 },
      { description: 'three quarter arc', startAngle: 0, endAngle: 270 },
      { description: 'rounded bars', startAngle: 0, endAngle: 270, roundedBars: true },
      { description: 'wide bar width', startAngle: 0, endAngle: 180, dimensions: { barWidth: 50 } },
      { description: 'narrow bar width', startAngle: 0, endAngle: 180, dimensions: { barWidth: 5 } },
      { description: 'narrow radius', startAngle: 0, endAngle: 180, dimensions: { radius: 50 } },
      {
        description: 'center x and y',
        startAngle: 0,
        endAngle: 360,
        roundedBars: true,
        dimensions: { centerX: 150, centerY: 200 },
      },
    ])(`should draw correct path for $description`, ({ startAngle, endAngle, dimensions, roundedBars }) => {
      const path = drawRadialArcPath(startAngle, endAngle, { ...defaultDims, ...dimensions }, roundedBars);
      expect(path).toMatchSnapshot();
    });

    describe('edge cases', () => {
      it('should adjust 360deg or greater  arcs to avoid SVG rendering issues', () => {
        expect(drawRadialArcPath(0, 360, defaultDims)).toEqual(drawRadialArcPath(0, 359.99, defaultDims));
        expect(drawRadialArcPath(0, 380, defaultDims)).toEqual(drawRadialArcPath(0, 380, defaultDims));
      });

      it('should throw an error if inner radius collapses to zero or below', () => {
        const smallRadiusDims = { ...defaultDims, radius: 5, barWidth: 20 };
        expect(() => drawRadialArcPath(0, 180, smallRadiusDims)).toThrow(
          'Inner radius collapsed to zero or below, cannot draw radial arc path'
        );
      });
    });
  });

  describe('getAngleBetweenSegments', () => {
    it('should calculate angle between segments based on spacing and count', () => {
      expect(getAngleBetweenSegments(2, 10, 360)).toBe(48);
      expect(getAngleBetweenSegments(5, 15, 180)).toBe(40);
    });
  });

  describe('getOptimalSegmentCount', () => {
    it('should adjust segment count based on dimensions and spacing', () => {
      const dimensions: RadialGaugeDimensions = {
        centerX: 100,
        centerY: 100,
        radius: 80,
        barWidth: 20,
        margin: 0,
        barIndex: 0,
        thresholdsBarWidth: 0,
        thresholdsBarSpacing: 0,
        thresholdsBarRadius: 0,
        scaleLabelsFontSize: 0,
        scaleLabelsSpacing: 0,
        scaleLabelsRadius: 0,
        gaugeBottomY: 0,
      };

      expect(getOptimalSegmentCount(dimensions, 2, 10, 360)).toBe(8);
      expect(getOptimalSegmentCount(dimensions, 1, 5, 360)).toBe(5);
    });
  });
});
