import { ScaleDistribution } from '@grafana/schema';

import { getGaugeScaleDistribution, getScaledPercent, getValueForScaledPercent } from './gaugeScale';

const log = { type: ScaleDistribution.Log };

describe('getGaugeScaleDistribution', () => {
  it('reads the scale from the custom field config', () => {
    expect(getGaugeScaleDistribution({ custom: { scaleDistribution: log } })).toEqual(log);
  });

  it('returns undefined when no scale is configured', () => {
    expect(getGaugeScaleDistribution({})).toBeUndefined();
  });
});

describe('getScaledPercent', () => {
  it('maps linearly when no scale is configured', () => {
    expect(getScaledPercent(25, 0, 100)).toBe(0.25);
  });

  it('places each decade an equal distance apart on a log scale', () => {
    expect(getScaledPercent(1e-6, 1e-9, 1e-3, log)).toBe(0.5);
    expect(getScaledPercent(10, 1, 1000, log)).toBeCloseTo(0.3333, 4);
  });

  it('returns more than 1 for values above max on a log scale', () => {
    expect(getScaledPercent(1e5, 1, 1e4, log)).toBeCloseTo(1.25, 10);
  });

  it.each([
    { desc: 'below min', value: 0.5 },
    { desc: 'zero', value: 0 },
    { desc: 'negative', value: -5 },
  ])('pins a $desc value to 0 on a log scale', ({ value }) => {
    expect(getScaledPercent(value, 1, 1e4, log)).toBe(0);
  });

  it.each([
    { desc: 'min is 0', min: 0, max: 100, expected: 0.4 },
    { desc: 'min is negative', min: -100, max: 100, expected: 0.7 },
    { desc: 'min is above max', min: 100, max: 0, expected: 0.6 },
  ])('falls back to linear on a log scale when $desc', ({ min, max, expected }) => {
    expect(getScaledPercent(40, min, max, log)).toBeCloseTo(expected, 10);
  });
});

describe('getValueForScaledPercent', () => {
  it('maps linearly when no scale is configured', () => {
    expect(getValueForScaledPercent(0.25, 0, 100)).toBe(25);
  });

  it('returns the geometric midpoint for 0.5 on a log scale', () => {
    expect(getValueForScaledPercent(0.5, 1, 1e4, log)).toBe(100);
  });

  it('returns min and max at the ends of a log scale', () => {
    expect(getValueForScaledPercent(0, 1e-9, 1e-3, log)).toBe(1e-9);
    expect(getValueForScaledPercent(1, 1e-9, 1e-3, log)).toBeCloseTo(1e-3, 15);
  });

  it('falls back to linear on a log scale when min is 0', () => {
    expect(getValueForScaledPercent(0.5, 0, 100, log)).toBe(50);
  });
});
