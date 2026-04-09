import type uPlot from 'uplot';

import { ScaleDirection, ScaleOrientation } from '@grafana/schema';

import { optMinMax, UPlotScaleBuilder } from './UPlotScaleBuilder';

function mockUPlot(scaleKey: string, distr: number): uPlot {
  return {
    scales: {
      [scaleKey]: { distr, log: 10 },
    },
  } as uPlot;
}

describe('UPlotScaleBuilder', () => {
  describe('getConfig range', () => {
    const scaleKey = 'y';
    const builder = new UPlotScaleBuilder({
      scaleKey,
      orientation: ScaleOrientation.Vertical,
      direction: ScaleDirection.Up,
      isTime: false,
    });
    //@ts-expect-error
    const scale: uPlot.Scales = builder.getConfig();
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
