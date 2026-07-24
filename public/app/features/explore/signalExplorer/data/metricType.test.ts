import { deriveMetricType } from './metricType';

describe('deriveMetricType', () => {
  it('maps explicit counter/gauge/summary metadata', () => {
    expect(deriveMetricType('http_requests_total', { type: 'counter' })).toBe('counter');
    expect(deriveMetricType('node_load1', { type: 'gauge' })).toBe('gauge');
    expect(deriveMetricType('rpc_duration', { type: 'summary' })).toBe('summary');
  });
  it('classic histogram: metadata histogram + _bucket-style name stays histogram', () => {
    expect(deriveMetricType('http_request_duration_seconds_bucket', { type: 'histogram' })).toBe('histogram');
  });
  it('native histogram: metadata histogram with a base (non _bucket) name', () => {
    expect(deriveMetricType('http_request_duration_seconds', { type: 'histogram' })).toBe('native histogram');
  });
  it('missing or empty metadata → unknown', () => {
    expect(deriveMetricType('mystery_metric', undefined)).toBe('unknown');
    expect(deriveMetricType('mystery_metric', { type: '' })).toBe('unknown');
  });
  it('unrecognized type string → unknown', () => {
    expect(deriveMetricType('x', { type: 'weird' })).toBe('unknown');
  });
});
