import { paramsWithMatcherAndState } from './prometheus';
const matcher = [{ name: 'severity', isRegex: false, isEqual: true, value: 'critical' }];
const matcherToJson = matcher.map((m) => JSON.stringify(m));
const matchers = [...matcher, { name: 'label1', isRegex: false, isEqual: true, value: 'hello there' }];
const matchersToJson = matchers.map((m) => JSON.stringify(m));
describe('paramsWithMatcherAndState method', () => {
    it('Should return same params object with no changes if there are no states nor matchers', () => {
        const params = { hello: 'there', bye: 'bye' };
        expect(paramsWithMatcherAndState(params)).toStrictEqual(params);
    });
    it('Should return params object with state if there are states and no matchers', () => {
        const params = { hello: 'there', bye: 'bye' };
        const state = ['firing', 'pending'];
        expect(paramsWithMatcherAndState(params, state)).toStrictEqual(Object.assign(Object.assign({}, params), { state: state }));
    });
    it('Should return params object with state if there are matchers and no states', () => {
        const params = { hello: 'there', bye: 'bye' };
        expect(paramsWithMatcherAndState(params, undefined, matcher)).toStrictEqual(Object.assign(Object.assign({}, params), { matcher: matcherToJson }));
        expect(paramsWithMatcherAndState(params, undefined, matchers)).toStrictEqual(Object.assign(Object.assign({}, params), { matcher: matchersToJson }));
    });
    it('Should return params object with stateand matchers if there are states and matchers', () => {
        const params = { hello: 'there', bye: 'bye' };
        const state = ['firing', 'pending'];
        expect(paramsWithMatcherAndState(params, state, matchers)).toStrictEqual(Object.assign(Object.assign({}, params), { state: state, matcher: matchersToJson }));
    });
});
//# sourceMappingURL=prometheus.test.js.map