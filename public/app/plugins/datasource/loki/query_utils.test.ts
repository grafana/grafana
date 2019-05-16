import { parseQuery, getHighlighterExpressionsFromQuery } from './query_utils';
import { LokiExpression } from './types';

describe('parseQuery', () => {
  it('returns empty for empty string', () => {
    expect(parseQuery('')).toEqual({
      query: '',
      regexp: '',
    } as LokiExpression);
  });

  it('returns regexp for strings without query', () => {
    expect(parseQuery('test')).toEqual({
      query: 'test',
      regexp: '',
    } as LokiExpression);
  });

  it('returns query for strings without regexp', () => {
    expect(parseQuery('{foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '',
    } as LokiExpression);
  });

  it('returns query for strings with query and search string', () => {
    expect(parseQuery('x {foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)x',
    } as LokiExpression);
  });

  it('returns query for strings with query and regexp', () => {
    expect(parseQuery('{foo="bar"} x|y')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)x|y',
    } as LokiExpression);
  });

  it('returns query for selector with two labels', () => {
    expect(parseQuery('{foo="bar", baz="42"}')).toEqual({
      query: '{foo="bar", baz="42"}',
      regexp: '',
    } as LokiExpression);
  });

  it('returns query and regexp with quantifiers', () => {
    expect(parseQuery('{foo="bar"} \\.java:[0-9]{1,5}')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)\\.java:[0-9]{1,5}',
    } as LokiExpression);
    expect(parseQuery('\\.java:[0-9]{1,5} {foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)\\.java:[0-9]{1,5}',
    } as LokiExpression);
  });

  it('returns query with filter operands as is', () => {
    expect(parseQuery('{foo="bar"} |= "x|y"')).toEqual({
      query: '{foo="bar"} |= "x|y"',
      regexp: '',
    } as LokiExpression);
    expect(parseQuery('{foo="bar"} |~ "42"')).toEqual({
      query: '{foo="bar"} |~ "42"',
      regexp: '',
    } as LokiExpression);
  });
});

describe('getHighlighterExpressionsFromQuery', () => {
  it('returns no expressions for empty query', () => {
    expect(getHighlighterExpressionsFromQuery('')).toEqual([]);
  });
  it('returns a single expressions for legacy query', () => {
    expect(getHighlighterExpressionsFromQuery('{} x')).toEqual(['(?i)x']);
    expect(getHighlighterExpressionsFromQuery('{foo="bar"} x')).toEqual(['(?i)x']);
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
});
