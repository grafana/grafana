import { parseQuery } from './query_utils';
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
      query: '',
      regexp: 'test',
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
      regexp: '|~ "(?i)x"',
    } as LokiExpression);
  });

  it('returns query for strings with query and regexp', () => {
    expect(parseQuery('{foo="bar"} x|y')).toEqual({
      query: '{foo="bar"}',
      regexp: '|~ "(?i)x|y"',
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
      regexp: '|~ "(?i)\\.java:[0-9]{1,5}"',
    } as LokiExpression);
    expect(parseQuery('\\.java:[0-9]{1,5} {foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '|~ "(?i)\\.java:[0-9]{1,5}"',
    } as LokiExpression);
  });

  it('returns query with filter operands as is', () => {
    expect(parseQuery('{foo="bar"} |= "x|y"')).toEqual({
      query: '{foo="bar"}',
      regexp: '|= "x|y"',
    } as LokiExpression);
    expect(parseQuery('{foo="bar"} |~ "42"')).toEqual({
      query: '{foo="bar"}',
      regexp: '|~ "42"',
    } as LokiExpression);
  });
});
