import { DEFAULT_RATE_UNIT, DEFAULT_UNIT, getPerSecondRateUnit, getUnit, getUnitFromMetric } from './units';

describe('getUnitFromMetric', () => {
  it('should return null for an empty string input', () => {
    expect(getUnitFromMetric('')).toBe(null);
  });

  it('should return the last part of the metric if it is a valid unit', () => {
    expect(getUnitFromMetric('go_gc_gomemlimit_bytes')).toBe('bytes');
    expect(getUnitFromMetric('go_gc_duration_seconds')).toBe('seconds');
  });

  it('should return the second to last part of the metric if it is a valid unit', () => {
    expect(getUnitFromMetric('go_gc_heap_allocs_by_size_bytes_count')).toBe('bytes');
    expect(getUnitFromMetric('go_cpu_classes_gc_mark_assist_cpu_seconds_total')).toBe('seconds');
  });

  it('should return null if no valid unit is found', () => {
    expect(getUnitFromMetric('ALERTS')).toBe(null);
    expect(getUnitFromMetric('utf8 metric with.dot')).toBe(null);
  });

  it('should handle metrics with extra underscores', () => {
    expect(getUnitFromMetric('go_gc__duration__seconds')).toBe('seconds');
  });

  it('should return null if the metric ends with an invalid unit', () => {
    expect(getUnitFromMetric('go_gc_duration_invalidunit')).toBe(null);
  });

  it('should return the last unit if the metric contains only valid units', () => {
    expect(getUnitFromMetric('bytes_seconds')).toBe('seconds');
  });
});

describe('getUnit', () => {
  it('should return the mapped unit for a valid metric part', () => {
    expect(getUnit('bytes')).toBe('bytes');
    expect(getUnit('seconds')).toBe('s');
  });

  it('should return the default unit if the metric part is undefined', () => {
    expect(getUnit(undefined)).toBe(DEFAULT_UNIT);
  });

  it('should return the default unit if the metric part is an empty string', () => {
    expect(getUnit('')).toBe(DEFAULT_UNIT);
  });

  it('should return the default unit if the metric part is not in UNIT_MAP', () => {
    expect(getUnit('invalidPart')).toBe(DEFAULT_UNIT);
  });

  it('should handle case sensitivity correctly', () => {
    expect(getUnit('BYTES')).toBe(DEFAULT_UNIT);
    expect(getUnit('Seconds')).toBe(DEFAULT_UNIT);
  });

  it('should not throw errors for unusual input', () => {
    expect(() => getUnit('123')).not.toThrow();
    expect(() => getUnit('some_random_string')).not.toThrow();
    expect(() => getUnit(undefined)).not.toThrow();
  });
});

describe('getPerSecondRateUnit', () => {
  it('should return the mapped rate unit for a valid metric part', () => {
    expect(getPerSecondRateUnit('bytes')).toBe('Bps');
    expect(getPerSecondRateUnit('seconds')).toBe('short');
  });

  it('should return the default rate unit if the metric part is undefined', () => {
    expect(getPerSecondRateUnit(undefined)).toBe(DEFAULT_RATE_UNIT);
  });

  it('should return the default rate unit if the metric part is an empty string', () => {
    expect(getPerSecondRateUnit('')).toBe(DEFAULT_RATE_UNIT);
  });

  it('should return the default rate unit if the metric part is not in RATE_UNIT_MAP', () => {
    expect(getPerSecondRateUnit('invalidPart')).toBe(DEFAULT_RATE_UNIT);
  });

  it('should handle case sensitivity correctly', () => {
    expect(getPerSecondRateUnit('BYTES')).toBe(DEFAULT_RATE_UNIT);
    expect(getPerSecondRateUnit('Seconds')).toBe(DEFAULT_RATE_UNIT);
  });

  it('should not throw errors for unusual input', () => {
    expect(() => getPerSecondRateUnit('123')).not.toThrow();
    expect(() => getPerSecondRateUnit('some_random_string')).not.toThrow();
    expect(() => getPerSecondRateUnit(undefined)).not.toThrow();
  });
});
