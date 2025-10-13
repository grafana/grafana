import { parser } from '@grafana/lezer-logql';

import { getLeftMostChild, getString, replaceVariables } from './parsingUtils';

describe('getLeftMostChild', () => {
  it('return left most child', () => {
    const tree = parser.parse('count_over_time({bar="baz"}[5m])');
    const child = getLeftMostChild(tree.topNode);
    expect(child).toBeDefined();
    expect(child!.name).toBe('CountOverTime');
  });
});

describe('replaceVariables', () => {
  it('should replace variables', () => {
    expect(replaceVariables('rate([{bar="${app}", baz="[[label_var]]"}[$__auto])')).toBe(
      'rate([{bar="__V_2__app__V__", baz="__V_1__label_var__V__"}[__V_0____auto__V__])'
    );
  });
});

describe('getString', () => {
  it('should return correct string representation of the node', () => {
    const expr = 'count_over_time({bar="baz"}[5m])';
    const tree = parser.parse(expr);
    const child = getLeftMostChild(tree.topNode);
    expect(getString(expr, child)).toBe('count_over_time');
  });

  it('should return string with correct variables', () => {
    const expr = 'count_over_time({bar="__V_2__app__V__"}[__V_0____auto__V__])';
    const tree = parser.parse(expr);
    expect(getString(expr, tree.topNode)).toBe('count_over_time({bar="${app}"}[$__auto])');
  });

  it('is symmetrical with replaceVariables', () => {
    const expr = 'count_over_time({bar="${app}", baz="[[label_var]]"}[$__auto])';
    const replaced = replaceVariables(expr);
    const tree = parser.parse(replaced);
    expect(getString(replaced, tree.topNode)).toBe(expr);
  });
});
