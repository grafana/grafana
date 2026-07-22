import type uPlot from 'uplot';

import { createTheme, type FieldColorMode, FieldColorModeId, ThresholdsMode } from '@grafana/data';
import { ScaleOrientation } from '@grafana/schema';

import { getGradientRange, getScaleGradientFn, scaleGradient } from './gradientFills';

function makeUPlot(
  scaleMin: number,
  scaleMax: number,
  orientation = ScaleOrientation.Horizontal,
  seriesData?: number[][]
) {
  const valToPos = jest.fn(
    (val: number, _scaleKey: string, _pct?: boolean) => ((val - scaleMin) / (scaleMax - scaleMin)) * 100
  );
  const series = (seriesData ?? []).map((data, i) => ({
    show: true,
    scale: i === 0 ? 'x' : 'y',
    data,
    min: undefined as number | undefined,
    max: undefined as number | undefined,
  }));

  return {
    scales: {
      x: { ori: orientation, min: 0, max: 100 },
      y: { min: scaleMin, max: scaleMax },
    },
    bbox: { left: 0, top: 0, width: 200, height: 100 },
    series,
    data: seriesData ?? [],
    valToPos,
  };
}

function asUPlot(u: ReturnType<typeof makeUPlot>): uPlot {
  return u as unknown as uPlot;
}

const theme = createTheme();

describe('getGradientRange', () => {
  it('returns hardMin/hardMax when provided', () => {
    const u = makeUPlot(0, 100);
    const [min, max] = getGradientRange(asUPlot(u), 'y', 10, 80);
    expect(min).toBe(10);
    expect(max).toBe(80);
  });

  it('uses softMin/softMax when hard values are not provided', () => {
    const u = makeUPlot(0, 100);
    const [min, max] = getGradientRange(asUPlot(u), 'y', null, null, 5, 95);
    expect(min).toBe(5);
    expect(max).toBe(95);
  });

  it('falls back to data range when no limits provided', () => {
    const u = makeUPlot(20, 80, ScaleOrientation.Horizontal, [
      [0, 1],
      [20, 80],
    ]);
    const [min, max] = getGradientRange(asUPlot(u), 'y');
    expect(min).toBe(20);
    expect(max).toBe(80);
  });
});

describe('scaleGradient', () => {
  it('returns the solid color string when only one stop covers the scale range', () => {
    const u = makeUPlot(0, 100);
    const stops: Array<[number, string]> = [[50, '#ff0000']];
    const result = scaleGradient(asUPlot(u), 'y', stops);
    expect(result).toBe('#ff0000');
  });

  it('returns a CanvasGradient object when multiple stops span the scale range', () => {
    const u = makeUPlot(0, 100);
    u.valToPos = jest.fn((_val: number, _key: string) => _val);
    const stops: Array<[number, string]> = [
      [0, '#00ff00'],
      [100, '#ff0000'],
    ];
    const result = scaleGradient(asUPlot(u), 'y', stops);
    expect(typeof result).toBe('object');
  });
});

describe('getScaleGradientFn', () => {
  it('throws when colorMode is missing', () => {
    expect(() =>
      getScaleGradientFn(1, theme, undefined, { mode: ThresholdsMode.Absolute, steps: [{ value: 0, color: 'green' }] })
    ).toThrow('Missing colorMode');
  });

  it('throws when thresholds is missing', () => {
    const colorMode = { id: FieldColorModeId.Thresholds } as unknown as FieldColorMode;
    expect(() => getScaleGradientFn(1, theme, colorMode, undefined)).toThrow('Missing thresholds');
  });

  it('returned function resolves gradient for threshold color mode', () => {
    const colorMode = { id: FieldColorModeId.Thresholds } as unknown as FieldColorMode;
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 50, color: 'red' },
      ],
    };
    const fn = getScaleGradientFn(0.5, theme, colorMode, thresholds, 0, 100);
    const u = makeUPlot(0, 100);
    u.series = [{ show: true, scale: 'y', data: [], min: undefined, max: undefined }];
    const result = fn(asUPlot(u), 0);
    expect(result).toBeDefined();
  });

  it('returned function handles percentage threshold mode', () => {
    const colorMode = { id: FieldColorModeId.Thresholds } as unknown as FieldColorMode;
    const thresholds = {
      mode: ThresholdsMode.Percentage,
      steps: [
        { value: 0, color: 'green' },
        { value: 80, color: 'red' },
      ],
    };
    const fn = getScaleGradientFn(0.5, theme, colorMode, thresholds, 0, 200);
    const u = makeUPlot(0, 200);
    u.series = [{ show: true, scale: 'y', data: [], min: undefined, max: undefined }];
    const result = fn(asUPlot(u), 0);
    expect(result).toBeDefined();
  });

  it('returned function handles getColors color mode', () => {
    const colorMode = {
      id: 'some-scheme',
      getColors: () => ['red', 'green', 'blue'],
    } as unknown as FieldColorMode;
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [{ value: 0, color: 'green' }],
    };
    const fn = getScaleGradientFn(1, theme, colorMode, thresholds, 0, 100);
    const u = makeUPlot(0, 100);
    u.series = [{ show: true, scale: 'y', data: [], min: undefined, max: undefined }];
    const result = fn(asUPlot(u), 0);
    expect(result).toBeDefined();
  });
});
