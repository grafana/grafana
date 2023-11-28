import { __awaiter } from "tslib";
import { getSituation } from './situation';
jest.mock('@grafana/runtime', () => (Object.assign({}, jest.requireActual('@grafana/runtime'))));
describe('situation', () => {
    const tests = [
        {
            query: '{}',
            cursorPos: 1,
            expected: { type: 'SPANSET_EMPTY' },
        },
        {
            query: '{.}',
            cursorPos: 2,
            expected: { type: 'SPANSET_ONLY_DOT' },
        },
        {
            query: '{.foo}',
            cursorPos: 5,
            expected: { type: 'SPANSET_IN_NAME_SCOPE', scope: '' },
        },
        {
            query: '{.foo }',
            cursorPos: 6,
            expected: { type: 'SPANSET_EXPRESSION_OPERATORS' },
        },
        {
            query: '{span.}',
            cursorPos: 6,
            expected: { type: 'SPANSET_IN_NAME_SCOPE', scope: 'span' },
        },
        {
            query: '{span.foo }',
            cursorPos: 10,
            expected: { type: 'SPANSET_EXPRESSION_OPERATORS' },
        },
        {
            query: '{span.foo = }',
            cursorPos: 12,
            expected: { type: 'SPANSET_IN_VALUE', tagName: 'span.foo', betweenQuotes: false },
        },
        {
            query: '{span.foo = "val" }',
            cursorPos: 18,
            expected: { type: 'SPANFIELD_COMBINING_OPERATORS' },
        },
        {
            query: '{span.foo = 200 }',
            cursorPos: 16,
            expected: { type: 'SPANFIELD_COMBINING_OPERATORS' },
        },
        {
            query: '{span.foo = "val" && }',
            cursorPos: 21,
            expected: { type: 'SPANSET_EMPTY' },
        },
        {
            query: '{span.foo = "val" && resource.}',
            cursorPos: 30,
            expected: { type: 'SPANSET_IN_NAME_SCOPE', scope: 'resource' },
        },
        {
            query: '{ .sla && span.http.status_code && span.http.status_code  = 200 }',
            cursorPos: 57,
            expected: { type: 'SPANSET_EXPRESSION_OPERATORS' },
        },
    ];
    tests.forEach((test) => {
        it(`${test.query} at ${test.cursorPos} is ${test.expected.type}`, () => __awaiter(void 0, void 0, void 0, function* () {
            const sit = getSituation(test.query, test.cursorPos);
            expect(sit).toEqual(Object.assign(Object.assign({}, test.expected), { query: test.query }));
        }));
    });
});
//# sourceMappingURL=situation.test.js.map