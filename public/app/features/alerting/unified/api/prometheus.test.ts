import { paramsWithMatcherAndState } from './prometheus';

describe('paramsWithMatcherAndState method', () => {
  it('Should return same params object with no changes if there are no states nor matchers', () => {
    const params: Record<string, string | string[]> = { hello: 'there', bye: 'bye' };
    expect(paramsWithMatcherAndState(params)).toStrictEqual(params);
  });
  it('Should return params object with state if there are states and no matchers', () => {
    const params: Record<string, string | string[]> = { hello: 'there', bye: 'bye' };
    const state: string[] = ['firing', 'pending'];
    expect(paramsWithMatcherAndState(params, state)).toStrictEqual({ ...params, state: state });
  });
  it('Should return params object with state if there are matchers and no states', () => {
    const params: Record<string, string | string[]> = { hello: 'there', bye: 'bye' };
    expect(paramsWithMatcherAndState(params, undefined, ['severity=critical'])).toStrictEqual({
      ...params,
      matcher: ['severity=critical'],
    });
    expect(paramsWithMatcherAndState(params, undefined, ['severity=critical', 'label1=hello there'])).toStrictEqual({
      ...params,
      matcher: ['severity=critical', 'label1=hello there'],
    });
  });
  it('Should return params object with stateand matchers if there are states and matchers', () => {
    const params: Record<string, string | string[]> = { hello: 'there', bye: 'bye' };
    const state: string[] = ['firing', 'pending'];
    const matchers = ['severity=critical', 'label1=hello there'];
    expect(paramsWithMatcherAndState(params, state, matchers)).toStrictEqual({
      ...params,
      state: state,
      matcher: ['severity=critical', 'label1=hello there'],
    });
  });
});
