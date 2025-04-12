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
    expect(replaceVariables('sum_over_time([[metric_var]]{bar="${app}"}[$__interval])')).toBe(
      'sum_over_time(__V_1__metric_var__V__{bar="__V_2__app__V__"}[__V_0____interval__V__])'
    );
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
    const replaced = replaceVariables(expr);
    const tree = parser.parse(replaced);
    expect(getString(replaced, tree.topNode)).toBe(expr);
  });
});

describe('replaceBuiltInVariables', () => {
  const testCases = [
    {
      expr: 'sum_over_time([[metric_var]]{bar="${app}"}[$__interval])',
      expected: 'sum_over_time([[metric_var]]{bar="${app}"}[1_999_999])',
    },
    {
      expr: 'sum_over_time([[metric_var]]{bar="${app}"}[$__rate_interval])',
      expected: 'sum_over_time([[metric_var]]{bar="${app}"}[3_999_999])',
    },
    {
      expr: 'sum_over_time([[metric_var]]{bar="${app}"}[$__range_ms])',
      expected: 'sum_over_time([[metric_var]]{bar="${app}"}[4_999_999])',
    },
    {
      expr: 'histogram_quantile(0.95, sum(rate(process_max_fds[$__rate_interval])) by (le)) + rate(process_max_fds[$__interval])',
      expected:
        'histogram_quantile(0.95, sum(rate(process_max_fds[3_999_999])) by (le)) + rate(process_max_fds[1_999_999])',
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
