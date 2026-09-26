import { observePerformanceEntries, setupNodePerformance } from './performanceTestUtils';
import { createPerformanceMark, createPerformanceMeasure, getTimeSinceBoot } from './performanceUtils';

describe('performanceUtils', () => {
  setupNodePerformance();

  beforeEach(() => {
    performance.mark('frontend_boot_js_done_time_seconds', { startTime: 0 });
    performance.mark('unrelated-mark');
  });

  it('returns the duration without retaining its measure or clearing other marks', () => {
    const durations = Array.from({ length: 100 }, getTimeSinceBoot);

    expect(durations.every(Number.isFinite)).toBe(true);

    expect(performance.getEntriesByName('time_since_boot', 'measure')).toHaveLength(0);
    expect(performance.getEntriesByName('frontend_boot_js_done_time_seconds', 'mark')).toHaveLength(1);
    expect(performance.getEntriesByName('unrelated-mark', 'mark')).toHaveLength(1);
  });

  it('publishes transient marks and measures to performance observers', async () => {
    const observedEntries = observePerformanceEntries();

    createPerformanceMark('observer-start', 10);
    createPerformanceMark('observer-end', 25);
    createPerformanceMeasure('observer-measure', 25, 15);
    createPerformanceMeasure('zero-duration-measure', 25, 0);
    createPerformanceMeasure('missing-duration-measure', 25, undefined);
    createPerformanceMeasure('negative-duration-measure', 25, -1);
    createPerformanceMeasure('non-finite-duration-measure', 25, Number.POSITIVE_INFINITY);
    createPerformanceMeasure('non-finite-end-measure', Number.NaN, 1);

    expect(performance.getEntriesByName('observer-start', 'mark')).toHaveLength(0);
    expect(performance.getEntriesByName('observer-end', 'mark')).toHaveLength(0);
    expect(performance.getEntriesByName('observer-measure', 'measure')).toHaveLength(0);
    expect(performance.getEntriesByName('zero-duration-measure', 'measure')).toHaveLength(0);
    const entries = await observedEntries;
    expect(entries).toEqual(
      expect.arrayContaining([
        { name: 'observer-start', startTime: 10, duration: 0 },
        { name: 'observer-end', startTime: 25, duration: 0 },
        { name: 'observer-measure', startTime: 10, duration: 15 },
        { name: 'zero-duration-measure', startTime: 25, duration: 0 },
      ])
    );
    const entryNames = entries.map(({ name }) => name);
    expect(entryNames).not.toContain('missing-duration-measure');
    expect(entryNames).not.toContain('negative-duration-measure');
    expect(entryNames).not.toContain('non-finite-duration-measure');
    expect(entryNames).not.toContain('non-finite-end-measure');
  });
});
