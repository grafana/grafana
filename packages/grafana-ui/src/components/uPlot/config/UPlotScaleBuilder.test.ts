import type uPlot from 'uplot';

import { ScaleDirection, ScaleDistribution, ScaleOrientation, StackingMode } from '@grafana/schema';

import { optMinMax, UPlotScaleBuilder } from './UPlotScaleBuilder';

function mockUPlot(scaleKey: string, distr: number): uPlot {
  return {
    scales: {
      [scaleKey]: { distr, log: 10 },
    },
  } as uPlot;
}

const baseProps = {
  scaleKey: 'y',
  orientation: ScaleOrientation.Vertical,
  direction: ScaleDirection.Up,
  isTime: false,
} as const;

describe('UPlotScaleBuilder', () => {
  describe('merge', () => {
    it('takes the smaller value for min', () => {
      const builder = new UPlotScaleBuilder({ ...baseProps, min: 10 });
      builder.merge({ ...baseProps, min: 5 });
      expect(builder.props.min).toBe(5);
    });

    it('keeps existing min when merging with a larger value', () => {
      const builder = new UPlotScaleBuilder({ ...baseProps, min: 5 });
      builder.merge({ ...baseProps, min: 10 });
      expect(builder.props.min).toBe(5);
    });

    it('takes the larger value for max', () => {
      const builder = new UPlotScaleBuilder({ ...baseProps, max: 10 });
      builder.merge({ ...baseProps, max: 20 });
      expect(builder.props.max).toBe(20);
    });

    it('keeps existing max when merging with a smaller value', () => {
      const builder = new UPlotScaleBuilder({ ...baseProps, max: 20 });
      builder.merge({ ...baseProps, max: 10 });
      expect(builder.props.max).toBe(20);
    });
  });

  describe('getConfig structure', () => {
    it('returns config keyed by scaleKey with dir, ori, and time fields', () => {
      const config = new UPlotScaleBuilder(baseProps).getConfig();
      expect(config).toHaveProperty('y');
      expect(config['y'].dir).toBe(ScaleDirection.Up);
      expect(config['y'].ori).toBe(ScaleOrientation.Vertical);
      expect(config['y'].time).toBe(false);
    });

    it('omits distr and log fields for time scales', () => {
      const config = new UPlotScaleBuilder({ ...baseProps, isTime: true }).getConfig();
      expect(config['y'].distr).toBeUndefined();
      expect(config['y'].log).toBeUndefined();
    });

    it('sets distr=3 and log base for log distribution', () => {
      const config = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 2,
      }).getConfig();
      expect(config['y'].distr).toBe(3);
      expect(config['y'].log).toBe(2);
    });

    it('falls back to log base 10 when an invalid log base is given', () => {
      const config = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 7,
      }).getConfig();
      expect(config['y'].log).toBe(10);
    });

    it('sets distr=4, log, and asinh for symlog distribution', () => {
      const config = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Symlog,
        log: 10,
        linearThreshold: 5,
      }).getConfig();
      expect(config['y'].distr).toBe(4);
      expect(config['y'].log).toBe(10);
      expect(config['y'].asinh).toBe(5);
    });

    it('defaults linearThreshold to 1 for symlog when not specified', () => {
      const config = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Symlog,
        log: 10,
      }).getConfig();
      expect(config['y'].asinh).toBe(1);
    });

    it('uses a provided custom range directly instead of a computed range function', () => {
      const customRange: uPlot.Range.MinMax = [-100, 200];
      const config = new UPlotScaleBuilder({ ...baseProps, range: customRange }).getConfig();
      expect(config['y'].range).toBe(customRange);
    });
  });

  describe('getConfig range', () => {
    const scaleKey = 'y';
    const builder = new UPlotScaleBuilder({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      isTime: false,
    });
    const scale = builder.getConfig();
    const rangeFn = scale[scaleKey].range as uPlot.Range.Function;

    // This is just asserting that the previous behavior is unchanged by https://github.com/grafana/grafana/pull/122057
    it('doesnt round deltas less than 0.0000001 clustered around 0', () => {
      const result = rangeFn(mockUPlot(scaleKey, 1), 0, 0.0000001, scaleKey);
      expect(result[0]).toEqual(0);
      expect(result[1]).toBeCloseTo(0.0000001, 7);
    });

    it('does not round range deltas +/- 0.000001', () => {
      const result = rangeFn(mockUPlot(scaleKey, 1), 0.999999, 1.000001, scaleKey);
      expect(result[0]).toBeCloseTo(0.99999, 4);
      expect(result[1]).toBeCloseTo(1.000001, 4);
    });

    it('rounds range deltas less than 0.0000001', () => {
      const result = rangeFn(mockUPlot(scaleKey, 1), 0.9999999, 1, scaleKey);
      expect(result).toEqual([0, 2]);
    });

    it('rounds range deltas +/- 0.0000001', () => {
      const result = rangeFn(mockUPlot(scaleKey, 1), 0.9999999, 1.0000001, scaleKey);
      expect(result).toEqual([0, 2]);
    });

    it('rounds range deltas 10 +/- 0.0000001', () => {
      const result = rangeFn(mockUPlot(scaleKey, 1), 9.9999999, 10.0000001, scaleKey);
      expect(result).toEqual([0, 20]);
    });

    it('rounds negative deltas', () => {
      const result = rangeFn(mockUPlot(scaleKey, 1), -1, -0.9999999, scaleKey);
      expect(result).toEqual([-2, 0]);
    });

    it('returns [null, null] when data is null and the range is not fixed', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(rangeFn(mockUPlot(scaleKey, 1), null as any, null as any, scaleKey)).toEqual([null, null]);
    });
  });

  describe('getConfig range - null data with fixed range', () => {
    it('still computes a valid range when hard min and max are set but data is null', () => {
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, min: 0, max: 100 }).getConfig()['y']
        .range as uPlot.Range.Function;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = rangeFn(mockUPlot('y', 1), null as any, null as any, 'y');
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(100);
    });
  });

  describe('getConfig range - hard limits enforcement', () => {
    it('enforces hard min as the final lower bound for linear scale', () => {
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, min: 5 }).getConfig()['y'].range as uPlot.Range.Function;
      expect(rangeFn(mockUPlot('y', 1), 10, 20, 'y')[0]).toBe(5);
    });

    it('enforces hard max as the final upper bound for linear scale', () => {
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, max: 50 }).getConfig()['y'].range as uPlot.Range.Function;
      expect(rangeFn(mockUPlot('y', 1), 10, 20, 'y')[1]).toBe(50);
    });
  });

  describe('getConfig range - centeredZero', () => {
    it('produces a symmetric range about zero', () => {
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, centeredZero: true }).getConfig()['y']
        .range as uPlot.Range.Function;
      const result = rangeFn(mockUPlot('y', 1), 3, 4, 'y');
      expect(result[0]).toBeLessThan(0);
      expect(result[1]).toBeGreaterThan(0);
      expect(result[0]!).toBeCloseTo(-result[1]!, 5);
    });

    it('uses ±80 as the base when all data values are zero', () => {
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, centeredZero: true }).getConfig()['y']
        .range as uPlot.Range.Function;
      const result = rangeFn(mockUPlot('y', 1), 0, 0, 'y');
      expect(result[0]).toBeLessThan(0);
      expect(result[1]).toBeGreaterThan(0);
      expect(result[0]!).toBeCloseTo(-result[1]!, 5);
    });
  });

  describe('getConfig range - decimals=0', () => {
    it('rounds linear scale range bounds to integers', () => {
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, decimals: 0 }).getConfig()['y']
        .range as uPlot.Range.Function;
      const result = rangeFn(mockUPlot('y', 1), 1.3, 2.7, 'y');
      expect(Number.isInteger(result[0])).toBe(true);
      expect(Number.isInteger(result[1])).toBe(true);
    });

    it('snaps log scale range to power-of-base boundaries', () => {
      const rangeFn = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 10,
        decimals: 0,
      }).getConfig()['y'].range as uPlot.Range.Function;
      const result = rangeFn(mockUPlot('y', 3), 2, 50, 'y');
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(100);
    });
  });

  describe('getConfig range - log distribution limit snapping', () => {
    it('treats a non-positive hard min the same as no hard min', () => {
      const u = mockUPlot('y', 3);
      const rangeFnInvalid = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 10,
        min: -5,
      }).getConfig()['y'].range as uPlot.Range.Function;
      const rangeFnNoMin = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 10,
      }).getConfig()['y'].range as uPlot.Range.Function;
      expect(rangeFnInvalid(u, 2, 50, 'y')).toEqual(rangeFnNoMin(u, 2, 50, 'y'));
    });

    it('snaps hard min down to the nearest log10 power boundary', () => {
      // min=5 → 10^floor(log10(5)) = 10^0 = 1
      const rangeFn = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 10,
        min: 5,
      }).getConfig()['y'].range as uPlot.Range.Function;
      expect(rangeFn(mockUPlot('y', 3), 2, 50, 'y')[0]).toBe(1);
    });

    it('snaps hard max up to the nearest log10 power boundary', () => {
      // max=50 → 10^ceil(log10(50)) = 10^2 = 100
      const rangeFn = new UPlotScaleBuilder({
        ...baseProps,
        distribution: ScaleDistribution.Log,
        log: 10,
        max: 50,
      }).getConfig()['y'].range as uPlot.Range.Function;
      expect(rangeFn(mockUPlot('y', 3), 2, 50, 'y')[1]).toBe(100);
    });
  });

  describe('getConfig range - StackingMode.Percent', () => {
    it('does not set softMin default when hardMin is already provided', () => {
      // hardMin=-0.5 prevents softMin from being set to 0; hardMinOnly=true enforces -0.5
      const rangeFn = new UPlotScaleBuilder({
        ...baseProps,
        stackingMode: StackingMode.Percent,
        min: -0.5,
      }).getConfig()['y'].range as uPlot.Range.Function;
      expect(rangeFn(mockUPlot('y', 1), 0, 0.5, 'y')[0]).toBe(-0.5);
    });

    it('does not set softMax default when hardMax is already provided', () => {
      // hardMax=2 prevents softMax from being set to 1; hardMaxOnly=true enforces 2
      const rangeFn = new UPlotScaleBuilder({ ...baseProps, stackingMode: StackingMode.Percent, max: 2 }).getConfig()[
        'y'
      ].range as uPlot.Range.Function;
      expect(rangeFn(mockUPlot('y', 1), 0, 0.5, 'y')[1]).toBe(2);
    });
  });

  it('opt min max', () => {
    expect(7).toEqual(optMinMax('min', null, 7));
    expect(7).toEqual(optMinMax('min', undefined, 7));
    expect(7).toEqual(optMinMax('min', 20, 7));

    expect(7).toEqual(optMinMax('min', 7, null));
    expect(7).toEqual(optMinMax('min', 7, undefined));
    expect(7).toEqual(optMinMax('min', 7, 20));

    expect(7).toEqual(optMinMax('max', null, 7));
    expect(7).toEqual(optMinMax('max', undefined, 7));
    expect(7).toEqual(optMinMax('max', 5, 7));

    expect(7).toEqual(optMinMax('max', 7, null));
    expect(7).toEqual(optMinMax('max', 7, undefined));
    expect(7).toEqual(optMinMax('max', 7, 5));
  });
});
