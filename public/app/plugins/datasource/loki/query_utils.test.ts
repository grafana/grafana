import { getHighlighterExpressionsFromQuery } from './query_utils';

describe('getHighlighterExpressionsFromQuery', () => {
  it('returns no expressions for empty query', () => {
    expect(getHighlighterExpressionsFromQuery('')).toEqual([]);
  });

  it('returns an expression for query with filter', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x"')).toEqual(['x']);
  });

  it('returns expressions for query with filter chain', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" |~ "y"')).toEqual(['x', 'y']);
  });

  it('returns drops expressions for query with negative filter chain', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x" != "y"')).toEqual(['x']);
  });

  it('returns null if filter term is not wrapped in double quotes', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= x')).toEqual(null);
  });

  it('escapes filter term if regex filter operator is not used', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |= "x[yz].w"')).toEqual(['x\\[yz\\]\\.w']);
  });

  it('does not escape filter term if regex filter operator is used', () => {
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} |~ "x[yz].w" |~ "z.+"')).toEqual(['x[yz].w', 'z.+']);
  });
});
