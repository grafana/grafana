import { DataLink } from '../types/dataLink';

import { getVariableUsageInfo } from './correlationUtils';

describe('getVariableUsageInfo', () => {
  function makeDataLinkWithQuery(query: string): DataLink {
    return {
      url: '',
      title: '',
      internal: {
        datasourceUid: 'uid',
        datasourceName: 'dsName',
        query: { query },
      },
    };
  }

  function allVariablesDefinedInQuery(query: string) {
    const scopedVars = {
      testVal: { text: '', value: 'val1' },
    };
    const replaceFn = jest.fn();
    return getVariableUsageInfo(makeDataLinkWithQuery(query), scopedVars, replaceFn).allVariablesDefined;
  }

  it('returns true when query contains variables and all variables are used', () => {
    expect(allVariablesDefinedInQuery('test ${testVal}')).toBe(true);
  });

  it('ignores global variables', () => {
    expect(allVariablesDefinedInQuery('test ${__rate_interval} $__from $__to')).toBe(true);
  });

  it('returns false when query contains variables and no variables are used', () => {
    expect(allVariablesDefinedInQuery('test ${diffVar}')).toBe(false);
  });

  it('returns false when query contains variables and some variables are used', () => {
    expect(allVariablesDefinedInQuery('test ${testVal} ${diffVar}')).toBe(false);
  });

  it('returns true when query contains no variables', () => {
    expect(allVariablesDefinedInQuery('test')).toBe(true);
  });

  it('returns deduplicated list of variables', () => {
    const dataLink = makeDataLinkWithQuery('test ${test} ${foo} ${test:raw} $test');
    const scopedVars = {
      testVal: { text: '', value: 'val1' },
    };
    const variables = getVariableUsageInfo(dataLink, scopedVars, jest.fn()).variables;
    expect(variables).toHaveLength(2);
  });
});
