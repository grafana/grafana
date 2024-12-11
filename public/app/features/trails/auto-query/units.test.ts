import { getUnitFromMetric } from './units';

// Tests for units
describe('getUnitFromMetric', () => {
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
  });
});
