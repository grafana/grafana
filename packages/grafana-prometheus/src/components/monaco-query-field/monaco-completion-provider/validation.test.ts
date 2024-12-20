// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/monaco-completion-provider/validation.test.ts
import { parser } from '@prometheus-io/lezer-promql';

import { validateQuery } from './validation';

describe('Monaco Query Validation', () => {
  test('Identifies empty queries as valid', () => {
    expect(validateQuery('', '', [], parser)).toBeFalsy();
  });

  test.each([
    'access_evaluation_duration_sum{job="grafana"}',
    'http_requests_total{job="apiserver", handler="/api/comments"}[5m]',
    'http_requests_total{job=~".*server"}',
    'rate(http_requests_total[5m])[30m:1m]',
    'max_over_time(deriv(rate(distance_covered_total[5s])[30s:5s])[10m:])',
    'rate(http_requests_total[5m])',
    'topk(3, sum by (app, proc) (rate(instance_cpu_time_ns[5m])))',
  ])('Identifies valid queries', (query: string) => {
    expect(validateQuery(query, query, [], parser)).toBeFalsy();
  });

  test('Identifies invalid queries', () => {
    // Missing } at the end
    let query = 'access_evaluation_duration_sum{job="grafana"';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 45,
        endLineNumber: 1,
        error: '{job="grafana"',
        startColumn: 31,
        startLineNumber: 1,
      },
    ]);

    // Missing handler="value"
    query = 'http_requests_total{job="apiserver", handler}[5m]';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 45,
        endLineNumber: 1,
        error: 'handler',
        startColumn: 38,
        startLineNumber: 1,
      },
    ]);

    // Missing : in [30s:5s]
    query = 'max_over_time(deriv(rate(distance_covered_total[5s])[30s5s])[10m:])';
    expect(validateQuery(query, query, [query], parser)).toEqual([
      {
        endColumn: 59,
        endLineNumber: 1,
        error: '5s',
        startColumn: 57,
        startLineNumber: 1,
      },
    ]);
  });

  test('Identifies valid multi-line queries', () => {
    const query = `
sum by (job) (
    rate(http_requests_total[5m])
)`;
    const queryLines = query.split('\n');
    expect(validateQuery(query, query, queryLines, parser)).toBeFalsy();
  });

  test('Identifies invalid multi-line queries', () => {
    const query = `
sum by (job) (
    rate(http_requests_total[])
)`;
    const queryLines = query.split('\n');
    expect(validateQuery(query, query, queryLines, parser)).toEqual([
      {
        endColumn: 30,
        endLineNumber: 3,
        error: '',
        startColumn: 30,
        startLineNumber: 3,
      },
    ]);
  });
});
