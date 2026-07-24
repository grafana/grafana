import type { DataQuery } from '@grafana/data';

import { detectMetricsInQueries } from './detectMetricsInQueries';

const known = new Set(['http_requests_total', 'node_load1', 'up']);

interface TestQuery extends DataQuery {
  expr?: string;
}

const q = (refId: string, expr: string): TestQuery => ({ refId, expr });

describe('detectMetricsInQueries', () => {
  it('detects a bare metric', () => {
    expect(detectMetricsInQueries([q('A', 'up')], known)).toEqual({ A: ['up'] });
  });
  it('detects a metric inside a function but NOT the function name', () => {
    const res = detectMetricsInQueries([q('A', 'rate(http_requests_total[5m])')], known);
    expect(res).toEqual({ A: ['http_requests_total'] }); // "rate" is not a known metric
  });
  it('detects multiple known metrics in one expr, de-duplicated', () => {
    const res = detectMetricsInQueries([q('A', 'up / node_load1 + up')], known);
    expect(res.A.sort()).toEqual(['node_load1', 'up']);
  });
  it('omits refIds with no known metric', () => {
    expect(detectMetricsInQueries([q('A', 'vector(1)')], known)).toEqual({});
  });
  it('ignores queries without an expr', () => {
    expect(detectMetricsInQueries([{ refId: 'A' } as TestQuery], known)).toEqual({});
  });
  it('does not match known name as substring of longer identifier', () => {
    expect(detectMetricsInQueries([q('A', 'node_up_time')], known)).toEqual({});
  });
  it('does not match known name as prefix of longer identifier', () => {
    expect(detectMetricsInQueries([q('A', 'http_requests_total_bucket')], known)).toEqual({});
  });
  it('matches known name when separated by boundary chars', () => {
    expect(detectMetricsInQueries([q('A', 'sum(up) by (job)')], known)).toEqual({ A: ['up'] });
  });
});
