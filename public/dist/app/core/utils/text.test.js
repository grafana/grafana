import { findMatchesInText } from './text';
describe('findMatchesInText()', function () {
    it('gets no matches for when search and or line are empty', function () {
        expect(findMatchesInText('', '')).toEqual([]);
        expect(findMatchesInText('foo', '')).toEqual([]);
        expect(findMatchesInText('', 'foo')).toEqual([]);
    });
    it('gets no matches for unmatched search string', function () {
        expect(findMatchesInText('foo', 'bar')).toEqual([]);
    });
    it('gets matches for matched search string', function () {
        expect(findMatchesInText('foo', 'foo')).toEqual([{ length: 3, start: 0, text: 'foo', end: 3 }]);
        expect(findMatchesInText(' foo ', 'foo')).toEqual([{ length: 3, start: 1, text: 'foo', end: 4 }]);
    });
    test('should find all matches for a complete regex', function () {
        expect(findMatchesInText(' foo foo bar ', 'foo|bar')).toEqual([
            { length: 3, start: 1, text: 'foo', end: 4 },
            { length: 3, start: 5, text: 'foo', end: 8 },
            { length: 3, start: 9, text: 'bar', end: 12 },
        ]);
    });
    test('not fail on incomplete regex', function () {
        expect(findMatchesInText(' foo foo bar ', 'foo|')).toEqual([
            { length: 3, start: 1, text: 'foo', end: 4 },
            { length: 3, start: 5, text: 'foo', end: 8 },
        ]);
        expect(findMatchesInText('foo foo bar', '(')).toEqual([]);
        expect(findMatchesInText('foo foo bar', '(foo|')).toEqual([]);
    });
});
//# sourceMappingURL=text.test.js.map