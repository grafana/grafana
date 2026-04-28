import { DataFrameType, type DataQueryRequest, dateTime, FieldType } from '@grafana/data';

import { randomWalk } from './randomWalk';
import { type GrafanaQuery, GrafanaQueryType } from './types';

function makeRequest(overrides?: Partial<DataQueryRequest<GrafanaQuery>>): DataQueryRequest<GrafanaQuery> {
  return {
    range: {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-01T01:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    },
    intervalMs: 60000, // 1 minute
    maxDataPoints: 60,
    targets: [],
    requestId: 'test',
    interval: '1m',
    scopedVars: {},
    timezone: 'browser',
    app: 'dashboard',
    startTime: 0,
    ...overrides,
  };
}

function makeQuery(overrides?: Partial<GrafanaQuery>): GrafanaQuery {
  return {
    refId: 'A',
    queryType: GrafanaQueryType.RandomWalk,
    ...overrides,
  };
}

describe('randomWalk', () => {
  it('should return 1 frame by default', () => {
    const frames = randomWalk(makeQuery(), makeRequest());
    expect(frames).toHaveLength(1);
  });

  it('should return N frames when seriesCount is set', () => {
    const frames = randomWalk(makeQuery({ seriesCount: 3 }), makeRequest());
    expect(frames).toHaveLength(3);
  });

  it('should have correct frame structure', () => {
    const frames = randomWalk(makeQuery(), makeRequest());
    const frame = frames[0];

    expect(frame.fields).toHaveLength(2);
    expect(frame.fields[0].name).toBe('time');
    expect(frame.fields[0].type).toBe(FieldType.time);
    expect(frame.fields[1].name).toBe('A-series');
    expect(frame.fields[1].type).toBe(FieldType.number);
    expect(frame.meta?.type).toBe(DataFrameType.TimeSeriesMulti);
    expect(frame.length).toBe(frame.fields[0].values.length);
  });

  it('should name series with suffix for multi-series', () => {
    const frames = randomWalk(makeQuery({ seriesCount: 3 }), makeRequest());
    expect(frames[0].fields[1].name).toBe('A-series');
    expect(frames[1].fields[1].name).toBe('A-series1');
    expect(frames[2].fields[1].name).toBe('A-series2');
  });

  it('should clamp values to min/max bounds', () => {
    const frames = randomWalk(makeQuery({ min: 10, max: 20, startValue: 15, spread: 100 }), makeRequest());
    const values = frames[0].fields[1].values as number[];
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it('should produce zero points when dropPercent is 100', () => {
    const frames = randomWalk(makeQuery({ dropPercent: 100 }), makeRequest());
    expect(frames[0].fields[0].values).toHaveLength(0);
    expect(frames[0].length).toBe(0);
  });

  it('should produce data points when dropPercent is 0', () => {
    const frames = randomWalk(makeQuery({ dropPercent: 0 }), makeRequest());
    expect(frames[0].fields[0].values.length).toBeGreaterThan(0);
  });

  it('should work with default values (no config fields set)', () => {
    const frames = randomWalk(makeQuery(), makeRequest());
    expect(frames).toHaveLength(1);
    expect(frames[0].fields[0].values.length).toBeGreaterThan(0);
  });

  it('should set interval on time field config', () => {
    const frames = randomWalk(makeQuery(), makeRequest({ intervalMs: 30000 } as DataQueryRequest<GrafanaQuery>));
    expect(frames[0].fields[0].config.interval).toBe(30000);
  });
});
