import { getHighlighterExpressionsFromQuery } from './query_utils';
describe('getHighlighterExpressionsFromQuery', function () {
    it('returns no expressions for empty query', function () {
        expect(getHighlighterExpressionsFromQuery('')).toEqual([]);
    });
    it('returns an expression for query with filter using quotes', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x"')).toEqual(['x']);
    });
    it('returns an expression for query with filter using backticks', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= `x`')).toEqual(['x']);
    });
    it('returns expressions for query with filter chain', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ "y"')).toEqual(['x', 'y']);
    });
    it('returns expressions for query with filter chain using both backticks and quotes', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ `y`')).toEqual(['x', 'y']);
    });
    it('returns expression for query with log parser', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" | logfmt')).toEqual(['x']);
    });
    it('returns expressions for query with filter chain folowed by log parser', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ "y" | logfmt')).toEqual(['x', 'y']);
    });
    it('returns drops expressions for query with negative filter chain using quotes', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" != "y"')).toEqual(['x']);
    });
    it('returns expressions for query with filter chain using backticks', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= `x` |~ `y`')).toEqual(['x', 'y']);
    });
    it('returns expressions for query with filter chain using quotes and backticks', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ `y`')).toEqual(['x', 'y']);
    });
    it('returns null if filter term is not wrapped in double quotes', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= x')).toEqual([]);
    });
    it('escapes filter term if regex filter operator is not used', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x[yz].w"')).toEqual(['x\\[yz\\]\\.w']);
    });
    it('does not escape filter term if regex filter operator is used', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ "x[yz].w" |~ "z.+"')).toEqual(['x[yz].w', 'z.+']);
    });
    it('removes extra backslash escaping if regex filter operator and quotes are used', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ "\\\\w+"')).toEqual(['\\w+']);
    });
    it('does not remove backslash escaping if regex filter operator and backticks are used', function () {
        expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ `\\w+`')).toEqual(['\\w+']);
    });
});
//# sourceMappingURL=query_utils.test.js.map