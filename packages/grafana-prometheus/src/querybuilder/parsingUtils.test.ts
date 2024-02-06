import { parser } from '@prometheus-io/lezer-promql';

import { getLeftMostChild, getString, replaceVariables } from './parsingUtils';

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
