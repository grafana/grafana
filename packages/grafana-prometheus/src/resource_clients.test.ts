import { processSeries } from './resource_clients';

describe('processSeries', () => {
  it('should extract metrics and label keys from series data', () => {
    const result = processSeries([
      {
        __name__: 'alerts',
        alertname: 'AppCrash',
        alertstate: 'firing',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
        severity: 'critical',
      },
      {
        __name__: 'alerts',
        alertname: 'AppCrash',
        alertstate: 'firing',
        instance: 'prometheus-utf8:9112',
        job: 'prometheus-utf8',
        severity: 'critical',
      },
      {
        __name__: 'counters_logins',
        app: 'backend',
        geohash: '9wvfgzurfzb',
        instance: 'fake-prometheus-data:9091',
        job: 'fake-data-gen',
        server: 'backend-01',
      },
    ]);

    // Check structure
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('labelKeys');

    // Verify metrics are extracted correctly
    expect(result.metrics).toEqual(['alerts', 'counters_logins']);

    // Verify all metrics are unique
    expect(result.metrics.length).toBe(new Set(result.metrics).size);

    // Verify label keys are extracted correctly and don't include __name__
    expect(result.labelKeys).toContain('instance');
    expect(result.labelKeys).toContain('job');
    expect(result.labelKeys).not.toContain('__name__');

    // Verify all label keys are unique
    expect(result.labelKeys.length).toBe(new Set(result.labelKeys).size);
  });

  it('should handle empty series data', () => {
    const result = processSeries([]);

    expect(result.metrics).toEqual([]);
    expect(result.labelKeys).toEqual([]);
  });

  it('should handle series without __name__ attribute', () => {
    const series = [
      { instance: 'localhost:9090', job: 'prometheus' },
      { instance: 'localhost:9100', job: 'node' },
    ];

    const result = processSeries(series);

    expect(result.metrics).toEqual([]);
    expect(result.labelKeys).toEqual(['instance', 'job']);
  });

  it('should extract label values for a specific key when findValuesForKey is provided', () => {
    const series = [
      {
        __name__: 'alerts',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
        severity: 'critical',
      },
      {
        __name__: 'alerts',
        instance: 'prometheus-utf8:9112',
        job: 'prometheus-utf8',
        severity: 'critical',
      },
      {
        __name__: 'counters_logins',
        instance: 'fake-prometheus-data:9091',
        job: 'fake-data-gen',
        severity: 'warning',
      },
    ];

    // Test finding values for 'job' label
    const jobResult = processSeries(series, 'job');
    expect(jobResult.labelValues).toEqual(['fake-data-gen', 'grafana', 'prometheus-utf8']);

    // Test finding values for 'severity' label
    const severityResult = processSeries(series, 'severity');
    expect(severityResult.labelValues).toEqual(['critical', 'warning']);

    // Test finding values for 'instance' label
    const instanceResult = processSeries(series, 'instance');
    expect(instanceResult.labelValues).toEqual([
      'fake-prometheus-data:9091',
      'host.docker.internal:3000',
      'prometheus-utf8:9112',
    ]);
  });

  it('should return empty labelValues array when findValuesForKey is not provided', () => {
    const series = [
      {
        __name__: 'alerts',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
      },
    ];

    const result = processSeries(series);
    expect(result.labelValues).toEqual([]);
  });

  it('should return empty labelValues array when findValuesForKey does not match any labels', () => {
    const series = [
      {
        __name__: 'alerts',
        instance: 'host.docker.internal:3000',
        job: 'grafana',
      },
    ];

    const result = processSeries(series, 'non_existent_label');
    expect(result.labelValues).toEqual([]);
  });
});
