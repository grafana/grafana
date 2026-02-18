import { computeTopLabels } from './useTopLabels';

describe('computeTopLabels', () => {
  it('should return empty array for empty series', () => {
    expect(computeTopLabels([])).toEqual([]);
  });

  it('should exclude internal labels', () => {
    const series = [
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule1', alertstate: 'firing', team: 'infra' },
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule2', alertstate: 'pending', team: 'platform' },
    ];

    const result = computeTopLabels(series);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('team');
  });

  it('should return top 5 labels sorted by frequency', () => {
    const series: Array<Record<string, string>> = [
      { team: 'a', env: 'prod', region: 'us', service: 'api', severity: 'critical', rare: 'x' },
      { team: 'b', env: 'prod', region: 'eu', service: 'web', severity: 'warn' },
      { team: 'c', env: 'staging', region: 'us', service: 'api' },
      { team: 'd', env: 'prod' },
      { team: 'e' },
    ];

    const result = computeTopLabels(series);

    expect(result).toHaveLength(5);
    // team appears in all 5
    expect(result[0].key).toBe('team');
    expect(result[0].count).toBe(5);
    // env appears in 4
    expect(result[1].key).toBe('env');
    expect(result[1].count).toBe(4);
    // region appears in 3
    expect(result[2].key).toBe('region');
    expect(result[2].count).toBe(3);
    // service appears in 3
    expect(result[3].key).toBe('service');
    expect(result[3].count).toBe(3);
    // severity appears in 2
    expect(result[4].key).toBe('severity');
    expect(result[4].count).toBe(2);
  });

  it('should include value distributions sorted by count', () => {
    const series = [
      { team: 'infra' },
      { team: 'infra' },
      { team: 'infra' },
      { team: 'platform' },
      { team: 'platform' },
      { team: 'backend' },
    ];

    const result = computeTopLabels(series);

    expect(result[0].key).toBe('team');
    expect(result[0].count).toBe(6);
    expect(result[0].values).toEqual([
      { value: 'infra', count: 3 },
      { value: 'platform', count: 2 },
      { value: 'backend', count: 1 },
    ]);
  });

  it('should handle series with only internal labels', () => {
    const series = [
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule1', alertstate: 'firing' },
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule2', alertstate: 'pending' },
    ];

    expect(computeTopLabels(series)).toEqual([]);
  });

  it('should limit value distributions to top 10', () => {
    // Create series where one label has more than 10 unique values
    const series = Array.from({ length: 15 }, (_, i) => ({ host: `host-${i}` }));

    const result = computeTopLabels(series);

    expect(result[0].key).toBe('host');
    expect(result[0].count).toBe(15);
    expect(result[0].values).toHaveLength(10);
  });
});
