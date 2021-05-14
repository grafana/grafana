import { containsVariable, getCurrentText, getVariableRefresh, isAllVariable } from './utils';
import { VariableRefresh } from './types';

const explore = require('../../core/utils/explore');

describe('containsVariable', () => {
  it.each`
    args      | expected
    ${[null]} | ${false}
  `("when called with params: 'variable': '$variable' then result should be '$expected'", ({ args, expected }) => {
    const spy = jest.spyOn(explore, 'safeStringifyValue');
    expect(containsVariable(args)).toEqual(expected);
    expect(spy).toBeCalled();
    expect(spy).toBeCalledTimes(1);
  });
});

describe('isAllVariable', () => {
  it.each`
    variable                                    | expected
    ${null}                                     | ${false}
    ${undefined}                                | ${false}
    ${{}}                                       | ${false}
    ${{ current: {} }}                          | ${false}
    ${{ current: { text: '' } }}                | ${false}
    ${{ current: { text: null } }}              | ${false}
    ${{ current: { text: undefined } }}         | ${false}
    ${{ current: { text: 'Alll' } }}            | ${false}
    ${{ current: { text: 'All' } }}             | ${true}
    ${{ current: { text: [] } }}                | ${false}
    ${{ current: { text: [null] } }}            | ${false}
    ${{ current: { text: [undefined] } }}       | ${false}
    ${{ current: { text: ['Alll'] } }}          | ${false}
    ${{ current: { text: ['Alll', 'All'] } }}   | ${false}
    ${{ current: { text: ['All'] } }}           | ${true}
    ${{ current: { text: { prop1: 'test' } } }} | ${false}
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
