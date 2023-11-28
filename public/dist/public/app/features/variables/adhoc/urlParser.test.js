import { toFilters, toUrl } from './urlParser';
describe('urlParser', () => {
    describe('parsing toUrl with no filters', () => {
        it('then url params should be correct', () => {
            const filters = [];
            const expected = [];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters', () => {
        it('then url params should be correct', () => {
            const a = createFilter('a');
            const b = createFilter('b', '>');
            const filters = [a, b];
            const expectedA = `${a.key}|${a.operator}|${a.value}`;
            const expectedB = `${b.key}|${b.operator}|${b.value}`;
            const expected = [expectedA, expectedB];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters containing special chars', () => {
        it('then url params should be correct', () => {
            const a = createFilter('a|');
            const b = createFilter('b', '>');
            const filters = [a, b];
            const expectedA = `a__gfp__-key|${a.operator}|a__gfp__-value`;
            const expectedB = `${b.key}|${b.operator}|${b.value}`;
            const expected = [expectedA, expectedB];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters without values', () => {
        it('then url params should be correct', () => {
            const a = {
                value: '',
                key: 'key',
                operator: '',
            };
            const filters = [a];
            const expectedA = `key||`;
            const expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters with undefined values', () => {
        it('then url params should be correct', () => {
            const a = {
                value: undefined,
                key: 'key',
                operator: undefined,
            };
            const filters = [a];
            const expectedA = `key||`;
            const expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters with number values', () => {
        it('then url params should be correct', () => {
            const a = {
                value: 1974,
                key: 'key',
                operator: '=',
            };
            const filters = [a];
            const expectedA = `key|=|1974`;
            const expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters with boolean values', () => {
        it('then url params should be correct', () => {
            const a = {
                value: false,
                key: 'key',
                operator: '=',
            };
            const filters = [a];
            const expectedA = `key|=|false`;
            const expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing no filters as string', () => {
        it('then url params should be correct', () => {
            const url = '';
            const expected = [];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing no filters as []', () => {
        it('then url params should be correct', () => {
            const url = [];
            const expected = [];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing one filter as string', () => {
        it('then url params should be correct', () => {
            const url = 'a-key|=|a-value';
            const a = createFilter('a', '=');
            const expected = [a];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing filters', () => {
        it('then url params should be correct', () => {
            const url = ['a-key|=|a-value', 'b-key|>|b-value'];
            const a = createFilter('a', '=');
            const b = createFilter('b', '>');
            const expected = [a, b];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing special chars', () => {
        it('then url params should be correct', () => {
            const url = ['a__gfp__-key|=|a__gfp__-value', 'b-key|>|b-value'];
            const a = createFilter('a|', '=');
            const b = createFilter('b', '>');
            const expected = [a, b];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing filter with empty values', () => {
        it('then url params should be correct', () => {
            const url = 'key||';
            const expected = [
                {
                    value: '',
                    key: 'key',
                    operator: '',
                },
            ];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing no filters as string', () => {
        it('then url params should be correct', () => {
            const url = '';
            const expected = [];
            expect(toFilters(url)).toEqual(expected);
        });
    });
});
function createFilter(value, operator = '=') {
    return {
        value: `${value}-value`,
        key: `${value}-key`,
        operator: operator,
    };
}
//# sourceMappingURL=urlParser.test.js.map