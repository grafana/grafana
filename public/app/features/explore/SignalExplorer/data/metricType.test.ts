import { deriveMetricType } from './metricType';

const none = new Set<string>();

describe('deriveMetricType', () => {
  it('maps explicit counter/gauge/summary metadata', () => {
    expect(deriveMetricType('http_requests_total', { type: 'counter' }, none)).toBe('counter');
    expect(deriveMetricType('node_load1', { type: 'gauge' }, none)).toBe('gauge');
    expect(deriveMetricType('rpc_duration', { type: 'summary' }, none)).toBe('summary');
  });
  it('classic histogram: metadata histogram + _bucket-style name stays histogram', () => {
    expect(deriveMetricType('http_request_duration_seconds_bucket', { type: 'histogram' }, none)).toBe('histogram');
  });
  it('native histogram: metadata histogram with a base (non _bucket) name', () => {
    expect(deriveMetricType('http_request_duration_seconds', { type: 'histogram' }, none)).toBe('native histogram');
  });
  it('missing or empty metadata → unknown', () => {
    expect(deriveMetricType('mystery_metric', undefined, none)).toBe('unknown');
    expect(deriveMetricType('mystery_metric', { type: '' }, none)).toBe('unknown');
  });
  it('unrecognized type string → unknown', () => {
    expect(deriveMetricType('x', { type: 'weird' }, none)).toBe('unknown');
  });

  describe('help-text fallback (no usable metadata type)', () => {
    it('reads a histogram out of the help text', () => {
      expect(deriveMetricType('request_duration_seconds', { help: 'A histogram of request latency' }, none)).toBe(
        'native histogram'
      );
      expect(
        deriveMetricType('request_duration_seconds_bucket', { help: 'A histogram of request latency' }, none)
      ).toBe('histogram');
    });

    it('reads a summary out of the help text', () => {
      expect(deriveMetricType('rpc_duration', { type: '', help: 'Summary of RPC latency' }, none)).toBe('summary');
    });

    it('does not override a type the metadata does state', () => {
      expect(deriveMetricType('queue_depth', { type: 'gauge', help: 'Approximates a histogram of depth' }, none)).toBe(
        'gauge'
      );
    });

    it('stays unknown when the help text says nothing useful', () => {
      expect(deriveMetricType('mystery_metric', { help: 'Some number about something' }, none)).toBe('unknown');
      expect(deriveMetricType('mystery_metric', { type: 'weird', help: '' }, none)).toBe('unknown');
    });
  });

  describe('name fallback (no usable metadata type)', () => {
    const histogram = new Set(['latency_seconds_bucket', 'latency_seconds_sum', 'latency_seconds_count']);
    const summary = new Set(['rpc_seconds', 'rpc_seconds_sum', 'rpc_seconds_count']);

    it('infers a counter from `_total`', () => {
      expect(deriveMetricType('grafanacloud_instance_discarded_attributed_samples_total', undefined, none)).toBe(
        'counter'
      );
      expect(deriveMetricType('http_requests_total', { type: 'unknown' }, none)).toBe('counter');
    });

    it('infers a classic histogram from `_bucket`', () => {
      expect(deriveMetricType('latency_seconds_bucket', undefined, none)).toBe('histogram');
    });

    it('infers a histogram for `_sum`/`_count` when the family has a `_bucket` series', () => {
      expect(deriveMetricType('latency_seconds_sum', undefined, histogram)).toBe('histogram');
      expect(deriveMetricType('latency_seconds_count', undefined, histogram)).toBe('histogram');
    });

    it('infers a summary for every series of a family with a bare name, `_sum` and `_count` but no `_bucket`', () => {
      expect(deriveMetricType('rpc_seconds', undefined, summary)).toBe('summary');
      expect(deriveMetricType('rpc_seconds_sum', undefined, summary)).toBe('summary');
      expect(deriveMetricType('rpc_seconds_count', undefined, summary)).toBe('summary');
    });

    it('leaves `_sum`/`_count` unknown when the other series cannot tell histogram from summary', () => {
      expect(deriveMetricType('rpc_seconds_sum', undefined, none)).toBe('unknown');
      expect(deriveMetricType('rpc_seconds_count', undefined, new Set(['rpc_seconds_sum', 'rpc_seconds_count']))).toBe(
        'unknown'
      );
    });

    it('does not call a bare name a summary when the family also has `_bucket`', () => {
      const dualScraped = new Set(['latency_seconds', ...histogram]);
      expect(deriveMetricType('latency_seconds', undefined, dualScraped)).toBe('unknown');
    });

    it('never infers a gauge', () => {
      expect(deriveMetricType('node_load1', undefined, none)).toBe('unknown');
    });

    it('does not override a type the metadata does state', () => {
      expect(deriveMetricType('odd_total', { type: 'gauge' }, none)).toBe('gauge');
    });

    it('takes precedence over the help text', () => {
      expect(deriveMetricType('observations_total', { help: 'Total observations fed into the histogram' }, none)).toBe(
        'counter'
      );
    });
  });
});
