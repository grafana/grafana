import { computeLabelStats } from './useLabelsBreakdown';

describe('computeLabelStats', () => {
  it('should return empty array for empty series', () => {
    expect(computeLabelStats([])).toEqual([]);
  });

  it('should exclude internal labels', () => {
    const series = [
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule1', alertstate: 'firing', team: 'infra' },
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule2', alertstate: 'pending', team: 'platform' },
    ];

    const result = computeLabelStats(series);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('team');
  });

  it('should sort labels by frequency', () => {
    const series: Array<Record<string, string>> = [
      { team: 'a', env: 'prod', region: 'us', service: 'api', severity: 'critical', rare: 'x' },
      { team: 'b', env: 'prod', region: 'eu', service: 'web', severity: 'warn' },
      { team: 'c', env: 'staging', region: 'us', service: 'api' },
      { team: 'd', env: 'prod' },
      { team: 'e' },
    ];

    const result = computeLabelStats(series);

    expect(result).toHaveLength(6);
    // team appears in all 5
    expect(result[0].key).toBe('team');
    // env appears in 4
    expect(result[1].key).toBe('env');
    // region appears in 3
    expect(result[2].key).toBe('region');
    // service appears in 3
    expect(result[3].key).toBe('service');
    // severity appears in 2
    expect(result[4].key).toBe('severity');
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

    const result = computeLabelStats(series);

    expect(result[0].key).toBe('team');
    expect(result[0].values).toEqual([
      { value: 'infra', firing: 0, pending: 0 },
      { value: 'platform', firing: 0, pending: 0 },
      { value: 'backend', firing: 0, pending: 0 },
    ]);
  });

  it('should handle series with only internal labels', () => {
    const series = [
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule1', alertstate: 'firing' },
      { __name__: 'GRAFANA_ALERTS', alertname: 'rule2', alertstate: 'pending' },
    ];

    expect(computeLabelStats(series)).toEqual([]);
  });

  it('should sort values by frequency', () => {
    const series = Array.from({ length: 15 }, (_, i) => ({ host: `host-${i}` }));

    const result = computeLabelStats(series);

    expect(result[0].key).toBe('host');
    expect(result[0].values).toHaveLength(15);
  });

  it('should return all labels sorted by frequency', () => {
    const series: Array<Record<string, string>> = [
      { team: 'a', env: 'prod', region: 'us', service: 'api', severity: 'critical', rare: 'x' },
      { team: 'b', env: 'prod', region: 'eu', service: 'web', severity: 'warn' },
      { team: 'c', env: 'staging', region: 'us', service: 'api' },
      { team: 'd', env: 'prod' },
      { team: 'e' },
    ];

    const result = computeLabelStats(series);

    expect(result).toHaveLength(6);
    expect(result.map((r) => r.key)).toEqual(['team', 'env', 'region', 'service', 'severity', 'rare']);
  });

  it('should return all values sorted by frequency', () => {
    const series = Array.from({ length: 15 }, (_, i) => ({ host: `host-${i}` }));

    const result = computeLabelStats(series);

    expect(result[0].key).toBe('host');
    expect(result[0].values).toHaveLength(15);
  });

  it('should count firing and pending instances per label key', () => {
    const series = [
      { alertstate: 'firing', team: 'infra', env: 'prod' },
      { alertstate: 'firing', team: 'infra', env: 'staging' },
      { alertstate: 'pending', team: 'platform', env: 'prod' },
      { alertstate: 'pending', team: 'infra', env: 'prod' },
    ];

    const result = computeLabelStats(series);

    const team = result.find((r) => r.key === 'team')!;
    expect(team.firing).toBe(2);
    expect(team.pending).toBe(2);

    const env = result.find((r) => r.key === 'env')!;
    expect(env.firing).toBe(2);
    expect(env.pending).toBe(2);
  });

  it('should count firing and pending per label value', () => {
    const series = [
      { alertstate: 'firing', team: 'infra' },
      { alertstate: 'firing', team: 'infra' },
      { alertstate: 'pending', team: 'infra' },
      { alertstate: 'firing', team: 'platform' },
      { alertstate: 'pending', team: 'platform' },
      { alertstate: 'pending', team: 'platform' },
    ];

    const result = computeLabelStats(series);
    const team = result.find((r) => r.key === 'team')!;

    const infra = team.values.find((v) => v.value === 'infra')!;
    expect(infra.firing).toBe(2);
    expect(infra.pending).toBe(1);

    const platform = team.values.find((v) => v.value === 'platform')!;
    expect(platform.firing).toBe(1);
    expect(platform.pending).toBe(2);
  });

  it('should report zero firing or pending when state is absent', () => {
    const series = [
      { alertstate: 'firing', team: 'infra' },
      { alertstate: 'firing', team: 'infra' },
    ];

    const result = computeLabelStats(series);

    const team = result.find((r) => r.key === 'team')!;
    expect(team.firing).toBe(2);
    expect(team.pending).toBe(0);
  });

  it('should exclude all internal labels', () => {
    const series = [
      {
        __name__: 'GRAFANA_ALERTS',
        alertname: 'HighCPU',
        alertstate: 'firing',
        folderUID: 'abc123',
        from: 'grafana',
        grafana_alertstate: 'Alerting',
        grafana_folder: 'MyFolder',
        grafana_rule_uid: 'rule1',
        orgID: '1',
        team: 'infra',
      },
    ];

    const result = computeLabelStats(series);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('team');
  });

  it('should handle non-standard alertstate values', () => {
    const series: Array<Record<string, string>> = [
      { alertstate: 'inactive', team: 'infra' },
      { alertstate: 'resolved', team: 'infra' },
      { team: 'infra' },
    ];

    const result = computeLabelStats(series);
    const team = result.find((r) => r.key === 'team')!;

    expect(team.firing).toBe(0);
    expect(team.pending).toBe(0);
  });

  it('should correctly count mixed alertstate values', () => {
    const series: Array<Record<string, string>> = [
      { alertstate: 'firing', team: 'infra' },
      { alertstate: 'pending', team: 'infra' },
      { team: 'infra' },
      { alertstate: 'inactive', team: 'infra' },
    ];

    const result = computeLabelStats(series);
    const team = result.find((r) => r.key === 'team')!;

    expect(team.firing).toBe(1);
    expect(team.pending).toBe(1);

    const infraValue = team.values.find((v) => v.value === 'infra')!;
    expect(infraValue.firing).toBe(1);
    expect(infraValue.pending).toBe(1);
  });

  it('should count empty string as a valid label value', () => {
    const series = [{ team: '' }, { team: '' }, { team: 'infra' }];

    const result = computeLabelStats(series);
    const team = result.find((r) => r.key === 'team')!;

    expect(team.values).toHaveLength(2);
    expect(team.values[0]).toEqual({ value: '', firing: 0, pending: 0 });
    expect(team.values[1]).toEqual({ value: 'infra', firing: 0, pending: 0 });
  });
});
