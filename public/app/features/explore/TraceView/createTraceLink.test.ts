import { getTimeRangeFromTimestamps } from './createTraceLink';

describe('getTimeRangeFromTimestamps', () => {
  const startTimeUs = 1_000_000;

  it('leaves a valid window unchanged', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 5_000_000);

    expect(range.from.valueOf()).toBe(1000);
    expect(range.to.valueOf()).toBe(6000);
  });

  it('expands a zero-width window by 1ms', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 0);

    expect(range.from.valueOf()).toBe(1000);
    expect(range.to.valueOf()).toBe(1001);
  });

  it('clamps an inverted window so to is 1ms after from', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 1_000, { startMs: 5_000, endMs: 0 });

    expect(range.from.valueOf()).toBe(6000);
    expect(range.to.valueOf()).toBe(6001);
  });

  it('clamps a window inverted by a negative end shift', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 1_000, { startMs: 0, endMs: -5_000 });

    expect(range.from.valueOf()).toBe(1000);
    expect(range.to.valueOf()).toBe(1001);
  });

  it('expands a short or inverted Splunk window to 1s', () => {
    const equal = getTimeRangeFromTimestamps(startTimeUs, 0, { startMs: 0, endMs: 0 }, true);
    expect(equal.from.valueOf()).toBe(1000);
    expect(equal.to.valueOf()).toBe(2000);

    const inverted = getTimeRangeFromTimestamps(startTimeUs, 1_000, { startMs: 5_000, endMs: 0 }, true);
    expect(inverted.from.valueOf()).toBe(6000);
    expect(inverted.to.valueOf()).toBe(7000);
  });
});
