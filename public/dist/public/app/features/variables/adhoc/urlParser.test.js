import { toFilters, toUrl } from './urlParser';
describe('urlParser', function () {
    describe('parsing toUrl with no filters', function () {
        it('then url params should be correct', function () {
            var filters = [];
            var expected = [];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters', function () {
        it('then url params should be correct', function () {
            var a = createFilter('a');
            var b = createFilter('b', '>');
            var filters = [a, b];
            var expectedA = a.key + "|" + a.operator + "|" + a.value;
            var expectedB = b.key + "|" + b.operator + "|" + b.value;
            var expected = [expectedA, expectedB];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters containing special chars', function () {
        it('then url params should be correct', function () {
            var a = createFilter('a|');
            var b = createFilter('b', '>');
            var filters = [a, b];
            var expectedA = "a__gfp__-key|" + a.operator + "|a__gfp__-value";
            var expectedB = b.key + "|" + b.operator + "|" + b.value;
            var expected = [expectedA, expectedB];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters without values', function () {
        it('then url params should be correct', function () {
            var a = {
                value: '',
                key: 'key',
                operator: '',
                condition: '',
            };
            var filters = [a];
            var expectedA = "key||";
            var expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters with undefined values', function () {
        it('then url params should be correct', function () {
            var a = {
                value: undefined,
                key: 'key',
                operator: undefined,
                condition: '',
            };
            var filters = [a];
            var expectedA = "key||";
            var expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters with number values', function () {
        it('then url params should be correct', function () {
            var a = {
                value: 1974,
                key: 'key',
                operator: '=',
                condition: '',
            };
            var filters = [a];
            var expectedA = "key|=|1974";
            var expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toUrl with filters with boolean values', function () {
        it('then url params should be correct', function () {
            var a = {
                value: false,
                key: 'key',
                operator: '=',
                condition: '',
            };
            var filters = [a];
            var expectedA = "key|=|false";
            var expected = [expectedA];
            expect(toUrl(filters)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing no filters as string', function () {
        it('then url params should be correct', function () {
            var url = '';
            var expected = [];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing no filters as []', function () {
        it('then url params should be correct', function () {
            var url = [];
            var expected = [];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing one filter as string', function () {
        it('then url params should be correct', function () {
            var url = 'a-key|=|a-value';
            var a = createFilter('a', '=');
            var expected = [a];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing filters', function () {
        it('then url params should be correct', function () {
            var url = ['a-key|=|a-value', 'b-key|>|b-value'];
            var a = createFilter('a', '=');
            var b = createFilter('b', '>');
            var expected = [a, b];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing special chars', function () {
        it('then url params should be correct', function () {
            var url = ['a__gfp__-key|=|a__gfp__-value', 'b-key|>|b-value'];
            var a = createFilter('a|', '=');
            var b = createFilter('b', '>');
            var expected = [a, b];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing filter with empty values', function () {
        it('then url params should be correct', function () {
            var url = 'key||';
            var expected = [
                {
                    value: '',
                    key: 'key',
                    operator: '',
                    condition: '',
                },
            ];
            expect(toFilters(url)).toEqual(expected);
        });
    });
    describe('parsing toFilters with url containing no filters as string', function () {
        it('then url params should be correct', function () {
            var url = '';
            var expected = [];
            expect(toFilters(url)).toEqual(expected);
        });
    });
});
function createFilter(value, operator) {
    if (operator === void 0) { operator = '='; }
    return {
        value: value + "-value",
        key: value + "-key",
        operator: operator,
        condition: '',
    };
}
//# sourceMappingURL=urlParser.test.js.map