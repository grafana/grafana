import type { MetricType } from '../types';

import { deriveMetricType, getMetricTypeLabel, getMetricTypeOptions } from './metricType';

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

  describe('help-text fallback (no usable metadata type)', () => {
    it('reads a histogram out of the help text', () => {
      expect(deriveMetricType('request_duration_seconds', { help: 'A histogram of request latency' })).toBe(
        'native histogram'
      );
      expect(deriveMetricType('request_duration_seconds_bucket', { help: 'A histogram of request latency' })).toBe(
        'histogram'
      );
    });

    it('reads a summary out of the help text', () => {
      expect(deriveMetricType('rpc_duration', { type: '', help: 'Summary of RPC latency' })).toBe('summary');
    });

    it('does not override a type the metadata does state', () => {
      expect(deriveMetricType('queue_depth', { type: 'gauge', help: 'Approximates a histogram of depth' })).toBe(
        'gauge'
      );
    });

    it('stays unknown when the help text says nothing useful', () => {
      expect(deriveMetricType('mystery_metric', { help: 'Some number about something' })).toBe('unknown');
      expect(deriveMetricType('mystery_metric', { type: 'weird', help: '' })).toBe('unknown');
    });
  });
});

describe('metric type labels', () => {
  // Every type `deriveMetricType` can return has to have a label; a row rendering `native histogram`
  // where the filter offers "Native histogram" would look like a different type altogether.
  it.each<[MetricType, string]>([
    ['counter', 'Counter'],
    ['gauge', 'Gauge'],
    ['histogram', 'Histogram'],
    ['native histogram', 'Native histogram'],
    ['summary', 'Summary'],
    ['unknown', 'Unknown'],
  ])('labels %s as "%s"', (type, label) => {
    expect(getMetricTypeLabel(type)).toBe(label);
  });

  it('degrades to the raw type rather than throwing on a value outside the union', () => {
    expect(getMetricTypeLabel('stateset' as MetricType)).toBe('stateset');
  });

  it('offers every type as a filter option, in a stable order', () => {
    expect(getMetricTypeOptions().map((option) => option.value)).toEqual([
      'counter',
      'gauge',
      'histogram',
      'native histogram',
      'summary',
      'unknown',
    ]);
  });

  it('uses the same label for a filter option as for a row', () => {
    for (const option of getMetricTypeOptions()) {
      expect(option.label).toBe(getMetricTypeLabel(option.value));
    }
  });
});
