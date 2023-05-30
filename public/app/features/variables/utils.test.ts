import { UrlQueryMap } from '@grafana/data';

import { VariableRefresh } from './types';
import {
  containsVariable,
  ensureStringValues,
  findTemplateVarChanges,
  getCurrentText,
  getVariableRefresh,
  isAllVariable,
} from './utils';

describe('isAllVariable', () => {
  it.each`
    variable                                         | expected
    ${null}                                          | ${false}
    ${undefined}                                     | ${false}
    ${{}}                                            | ${false}
    ${{ current: {} }}                               | ${false}
    ${{ current: { text: '' } }}                     | ${false}
    ${{ current: { text: null } }}                   | ${false}
    ${{ current: { text: undefined } }}              | ${false}
    ${{ current: { text: 'Alll' } }}                 | ${false}
    ${{ current: { text: 'All' } }}                  | ${true}
    ${{ current: { text: [] } }}                     | ${false}
    ${{ current: { text: [null] } }}                 | ${false}
    ${{ current: { text: [undefined] } }}            | ${false}
    ${{ current: { text: ['Alll'] } }}               | ${false}
    ${{ current: { text: ['Alll', 'All'] } }}        | ${false}
    ${{ current: { text: ['All'] } }}                | ${true}
    ${{ current: { text: ['All', 'Alll'] } }}        | ${true}
    ${{ current: { text: { prop1: 'test' } } }}      | ${false}
    ${{ current: { value: '' } }}                    | ${false}
    ${{ current: { value: null } }}                  | ${false}
    ${{ current: { value: undefined } }}             | ${false}
    ${{ current: { value: '$__alll' } }}             | ${false}
    ${{ current: { value: '$__all' } }}              | ${true}
    ${{ current: { value: [] } }}                    | ${false}
    ${{ current: { value: [null] } }}                | ${false}
    ${{ current: { value: [undefined] } }}           | ${false}
    ${{ current: { value: ['$__alll'] } }}           | ${false}
    ${{ current: { value: ['$__alll', '$__all'] } }} | ${false}
    ${{ current: { value: ['$__all'] } }}            | ${true}
    ${{ current: { value: ['$__all', '$__alll'] } }} | ${true}
    ${{ current: { value: { prop1: 'test' } } }}     | ${false}
    ${{ current: { value: '', text: '' } }}          | ${false}
    ${{ current: { value: '', text: 'All' } }}       | ${true}
    ${{ current: { value: '$__all', text: '' } }}    | ${true}
    ${{ current: { value: '', text: ['All'] } }}     | ${true}
    ${{ current: { value: ['$__all'], text: '' } }}  | ${true}
  `("when called with params: 'variable': '$variable' then result should be '$expected'", ({ variable, expected }) => {
    expect(isAllVariable(variable)).toEqual(expected);
  });
});

describe('getCurrentText', () => {
  it.each`
    variable                                    | expected
    ${null}                                     | ${''}
    ${undefined}                                | ${''}
    ${{}}                                       | ${''}
    ${{ current: {} }}                          | ${''}
    ${{ current: { text: '' } }}                | ${''}
    ${{ current: { text: null } }}              | ${''}
    ${{ current: { text: undefined } }}         | ${''}
    ${{ current: { text: 'A' } }}               | ${'A'}
    ${{ current: { text: 'All' } }}             | ${'All'}
    ${{ current: { text: [] } }}                | ${''}
    ${{ current: { text: [null] } }}            | ${''}
    ${{ current: { text: [undefined] } }}       | ${''}
    ${{ current: { text: ['A'] } }}             | ${'A'}
    ${{ current: { text: ['A', 'All'] } }}      | ${'A,All'}
    ${{ current: { text: ['All'] } }}           | ${'All'}
    ${{ current: { text: { prop1: 'test' } } }} | ${''}
  `("when called with params: 'variable': '$variable' then result should be '$expected'", ({ variable, expected }) => {
    expect(getCurrentText(variable)).toEqual(expected);
  });
});

describe('getVariableRefresh', () => {
  it.each`
    variable                                           | expected
    ${null}                                            | ${VariableRefresh.never}
    ${undefined}                                       | ${VariableRefresh.never}
    ${{}}                                              | ${VariableRefresh.never}
    ${{ refresh: VariableRefresh.never }}              | ${VariableRefresh.never}
    ${{ refresh: VariableRefresh.onTimeRangeChanged }} | ${VariableRefresh.onTimeRangeChanged}
    ${{ refresh: VariableRefresh.onDashboardLoad }}    | ${VariableRefresh.onDashboardLoad}
    ${{ refresh: 'invalid' }}                          | ${VariableRefresh.never}
  `("when called with params: 'variable': '$variable' then result should be '$expected'", ({ variable, expected }) => {
    expect(getVariableRefresh(variable)).toEqual(expected);
  });
});

describe('findTemplateVarChanges', () => {
  it('detect adding/removing a variable', () => {
    const a: UrlQueryMap = {};
    const b: UrlQueryMap = {
      'var-xyz': 'hello',
      aaa: 'ignore me',
    };

    expect(findTemplateVarChanges(b, a)).toEqual({ 'var-xyz': { value: 'hello' } });
    expect(findTemplateVarChanges(a, b)).toEqual({ 'var-xyz': { value: '', removed: true } });
  });

  it('then should ignore equal values', () => {
    const a: UrlQueryMap = {
      'var-xyz': 'hello',
      bbb: 'ignore me',
    };
    const b: UrlQueryMap = {
      'var-xyz': 'hello',
      aaa: 'ignore me',
    };

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('then should ignore equal values with empty values', () => {
    const a: UrlQueryMap = {
      'var-xyz': '',
      bbb: 'ignore me',
    };
    const b: UrlQueryMap = {
      'var-xyz': '',
      aaa: 'ignore me',
    };

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('then should ignore empty array values', () => {
    const a: UrlQueryMap = {
      'var-adhoc': [],
    };
    const b: UrlQueryMap = {};

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('Should handle array values with one value same as just value', () => {
    const a: UrlQueryMap = {
      'var-test': ['test'],
    };
    const b: UrlQueryMap = {
      'var-test': 'test',
    };

    expect(findTemplateVarChanges(b, a)).toBeUndefined();
    expect(findTemplateVarChanges(a, b)).toBeUndefined();
  });

  it('Should detect change in array value and return array with single value', () => {
    const a: UrlQueryMap = {
      'var-test': ['test'],
    };
    const b: UrlQueryMap = {
      'var-test': 'asd',
    };

    expect(findTemplateVarChanges(a, b)!['var-test']).toEqual({ value: ['test'] });
  });
});

describe('ensureStringValues', () => {
  it.each`
    value              | expected
    ${null}            | ${''}
    ${undefined}       | ${''}
    ${{}}              | ${''}
    ${{ current: {} }} | ${''}
    ${1}               | ${'1'}
    ${[1, 2]}          | ${['1', '2']}
    ${'1'}             | ${'1'}
    ${['1', '2']}      | ${['1', '2']}
    ${true}            | ${'true'}
  `('when called with value:$value then result should be:$expected', ({ value, expected }) => {
    expect(ensureStringValues(value)).toEqual(expected);
  });
});

describe('containsVariable', () => {
  it.each`
    value                                 | expected
    ${''}                                 | ${false}
    ${'$var'}                             | ${true}
    ${{ thing1: '${var}' }}               | ${true}
    ${{ thing1: '${var:fmt}' }}           | ${true}
    ${{ thing1: '${var.fieldPath}' }}     | ${true}
    ${{ thing1: '${var.fieldPath:fmt}' }} | ${true}
    ${{ thing1: ['1', '${var}'] }}        | ${true}
    ${{ thing1: ['1', '[[var]]'] }}       | ${true}
    ${{ thing1: ['1', '[[var:fmt]]'] }}   | ${true}
    ${{ thing1: { thing2: '${var}' } }}   | ${true}
    ${{ params: [['param', '$var']] }}    | ${true}
    ${{ params: [['param', '${var}']] }}  | ${true}
  `('when called with value:$value then result should be:$expected', ({ value, expected }) => {
    expect(containsVariable(value, 'var')).toEqual(expected);
  });
});
