import { CONTINUOUS_PALETTE_STEPS, paletteColorAt, quantizeInterpolator } from './colorQuantize';

describe('quantizeInterpolator', () => {
  // simple deterministic interpolator: t -> "t:<value>"
  const interpolate = (t: number) => `t:${t}`;

  it('returns the requested number of steps', () => {
    expect(quantizeInterpolator(interpolate, 8)).toHaveLength(8);
  });

  it('defaults to CONTINUOUS_PALETTE_STEPS', () => {
    expect(quantizeInterpolator(interpolate)).toHaveLength(CONTINUOUS_PALETTE_STEPS);
  });

  it('samples the endpoints at 0 and 1', () => {
    const palette = quantizeInterpolator(interpolate, 8);
    expect(palette[0]).toBe('t:0');
    expect(palette[palette.length - 1]).toBe('t:1');
  });

  it('samples interior steps evenly across [0, 1]', () => {
    const palette = quantizeInterpolator(interpolate, 5);
    expect(palette).toEqual(['t:0', 't:0.25', 't:0.5', 't:0.75', 't:1']);
  });
});

describe('paletteColorAt', () => {
  const palette = ['a', 'b', 'c', 'd'];

  it('indexes interior percents with floor(percent * length)', () => {
    expect(paletteColorAt(palette, 0)).toBe('a');
    expect(paletteColorAt(palette, 0.25)).toBe('b');
    expect(paletteColorAt(palette, 0.5)).toBe('c');
    expect(paletteColorAt(palette, 0.74)).toBe('c');
    expect(paletteColorAt(palette, 0.75)).toBe('d');
  });

  it('clamps percent at or above 1 to the last color', () => {
    expect(paletteColorAt(palette, 1)).toBe('d');
    expect(paletteColorAt(palette, 1.5)).toBe('d');
  });

  it('clamps negative percent to the first color', () => {
    expect(paletteColorAt(palette, -0.5)).toBe('a');
  });
});
