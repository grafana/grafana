// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/parsingUtils.test.ts
import { parser } from '@prometheus-io/lezer-promql';

import {
  getLeftMostChild,
  getString,
  replaceBuiltInVariable,
  replaceVariables,
  returnBuiltInVariable,
} from './parsingUtils';

describe('getLeftMostChild', () => {
  it('return left most child', () => {
    const tree = parser.parse('sum_over_time(foo{bar="baz"}[5m])');
    const child = getLeftMostChild(tree.topNode);
    expect(child).toBeDefined();
    expect(child!.name).toBe('SumOverTime');
  });
});

describe('replaceVariables', () => {
  it('should replace variables', () => {
    const { replacedExpr, replacedVariables } = replaceVariables(
      'sum_over_time([[metric_var]]{bar="${app}"}[$__interval])'
    );
    expect(replacedExpr).toBe('sum_over_time(__V_1__metric_var__V__{bar="__V_2__app__V__"}[__V_0____interval__V__])');
    expect(replacedVariables).toEqual({
      __V_1__metric_var__V__: '[[metric_var]]',
      __V_2__app__V__: '${app}',
      __V_0____interval__V__: '$__interval',
    });
  });
});

describe('getString', () => {
  it('should return correct string representation of the node', () => {
    const expr = 'sum_over_time(foo{bar="baz"}[5m])';
    const tree = parser.parse(expr);
    const child = getLeftMostChild(tree.topNode);
    expect(getString(expr, child)).toBe('sum_over_time');
  });

  it('should return string with correct variables', () => {
    const expr = 'sum_over_time(__V_1__metric_var__V__{bar="__V_2__app__V__"}[__V_0____interval__V__])';
    const tree = parser.parse(expr);
    expect(getString(expr, tree.topNode)).toBe('sum_over_time([[metric_var]]{bar="${app}"}[$__interval])');
  });

  it('is symmetrical with replaceVariables', () => {
    const expr = 'sum_over_time([[metric_var]]{bar="${app}"}[$__interval])';
    const { replacedExpr, replacedVariables } = replaceVariables(expr);
    const tree = parser.parse(replacedExpr);
    expect(getString(replacedExpr, tree.topNode)).toBe(expr);
    expect(replacedVariables).toEqual({
      __V_1__metric_var__V__: '[[metric_var]]',
      __V_2__app__V__: '${app}',
      __V_0____interval__V__: '$__interval',
    });
  });
});

describe('builtInTimeVariables', () => {
  const testCases = [
    {
      expr: 'sum_over_time([[metric_var]]{bar="${app}"}[$__interval])',
      expected: 'sum_over_time([[metric_var]]{bar="${app}"}[711_999_999])',
    },
    {
      expr: 'sum_over_time([[metric_var]]{bar="${app}"}[$__rate_interval])',
      expected: 'sum_over_time([[metric_var]]{bar="${app}"}[7999799979997999])',
    },
    {
      expr: 'sum_over_time([[metric_var]]{bar="${app}"}[$__range_ms])',
      expected: 'sum_over_time([[metric_var]]{bar="${app}"}[722_999_999])',
    },
    {
      expr: 'histogram_quantile(0.95, sum(rate(process_max_fds[$__rate_interval])) by (le)) + rate(process_max_fds[$__interval])',
      expected:
        'histogram_quantile(0.95, sum(rate(process_max_fds[7999799979997999])) by (le)) + rate(process_max_fds[711_999_999])',
    },
    {
      expr: 'rate(http_requests_total{job="api-server"}[$__interval_ms] offset $__interval_ms)',
      expected: 'rate(http_requests_total{job="api-server"}[79_999_999_999] offset 79_999_999_999)',
    },
    {
      expr: 'max_over_time(node_memory_usage[$__range_s])',
      expected: 'max_over_time(node_memory_usage[79_299_999])',
    },
    {
      expr: 'avg_over_time(cpu_usage{env="prod"}[$__range])',
      expected: 'avg_over_time(cpu_usage{env="prod"}[799_999])',
    },
    {
      expr: 'rate(requests[$__interval]) / rate(requests[$__interval] offset $__interval)',
      expected: 'rate(requests[711_999_999]) / rate(requests[711_999_999] offset 711_999_999)',
    },
    {
      expr: 'sum(rate(http_requests_total{status=~"5.."}[$__rate_interval])) / sum(rate(http_requests_total[$__rate_interval])) or vector($__range_ms / $__interval_ms)',
      expected:
        'sum(rate(http_requests_total{status=~"5.."}[7999799979997999])) / sum(rate(http_requests_total[7999799979997999])) or vector(722_999_999 / 79_999_999_999)',
    },
    {
      expr: 'sum(rate(http_requests_total{job="api"}[5m]))',
      expected: 'sum(rate(http_requests_total{job="api"}[5m]))',
    },
    {
      expr: 'max_over_time(rate(cpu{instance="server-01"}[$__interval])[$__range_s:$__interval])',
      expected: 'max_over_time(rate(cpu{instance="server-01"}[711_999_999])[79_299_999:711_999_999])',
    },
    {
      expr: 'rate(cpu[$__interval]) + rate(memory[$__interval_ms]) + rate(disk[$__rate_interval]) + rate(network[$__range]) + rate(io[$__range_s]) + rate(gpu[$__range_ms])',
      expected:
        'rate(cpu[711_999_999]) + rate(memory[79_999_999_999]) + rate(disk[7999799979997999]) + rate(network[799_999]) + rate(io[79_299_999]) + rate(gpu[722_999_999])',
    },
  ];

  testCases.forEach((testCase) => {
    it(testCase.expr, () => {
      const actual1 = replaceBuiltInVariable(testCase.expr);
      expect(actual1).toBe(testCase.expected);

      const actual2 = returnBuiltInVariable(actual1);
      expect(actual2).toBe(testCase.expr);
    });
  });
});
