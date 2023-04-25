import { paramsWithMatcherAndState } from './prometheus';

const matcher = [{ name: 'severity', isRegex: false, isEqual: true, value: 'critical' }];
const matcherToJson = matcher.map((m) => JSON.stringify(m));
const matchers = [...matcher, { name: 'label1', isRegex: false, isEqual: true, value: 'hello there' }];
const matchersToJson = matchers.map((m) => JSON.stringify(m));

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
    expect(paramsWithMatcherAndState(params, undefined, matcher)).toStrictEqual({
      ...params,
      matcher: matcherToJson,
    });
    expect(paramsWithMatcherAndState(params, undefined, matchers)).toStrictEqual({
      ...params,
      matcher: matchersToJson,
    });
  });
  it('Should return params object with stateand matchers if there are states and matchers', () => {
    const params: Record<string, string | string[]> = { hello: 'there', bye: 'bye' };
    const state: string[] = ['firing', 'pending'];
    expect(paramsWithMatcherAndState(params, state, matchers)).toStrictEqual({
      ...params,
      state: state,
      matcher: matchersToJson,
    });
  });
});
