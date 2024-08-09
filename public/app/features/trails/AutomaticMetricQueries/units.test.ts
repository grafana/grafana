import { getUnitFromMetric, getUnitFromRecordingRule } from './units';

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

// Tests for recording rules
describe('getUnitFromRecordingRule', () => {
  it('should return a valid unit if one is listed in the recording rule', () => {
    expect(getUnitFromRecordingRule('workload:memory_working_set_bytes:sum')).toBe('bytes');
    expect(getUnitFromRecordingRule('cluster_job:cortex_request_duration_seconds:99quantile')).toBe('seconds');
  });

  it('should handle recording rules with : and _ and .', () => {
    expect(getUnitFromRecordingRule('k8s.rules:container_memory_working_set_bytes')).toBe('bytes');
  });

  // this test also handles capitalization of a unit - should i separate that into a different test?
  it('should return a valid unit for recording rules with no separators', () => {
    expect(getUnitFromRecordingRule('KubePersistentVolumeFillingUpSeconds')).toBe('seconds');
    expect(getUnitFromRecordingRule('HelloWorldBytes')).toBe('bytes');
  });

  it('should return null if no valid unit is found', () => {
    expect(getUnitFromRecordingRule('instance_path:requests:rate5m')).toBe(null);
  });

  it('should return null if no valid unit is found in recording rules with no separators', () => {
    expect(getUnitFromRecordingRule('KubePersistentVolumeFillingUp')).toBe(null);
  });
});
