import { parseQuery } from './query_utils';

describe('parseQuery', () => {
  it('returns empty for empty string', () => {
    expect(parseQuery('')).toEqual({
      query: '',
      regexp: '',
    });
  });

  it('returns regexp for strings without query', () => {
    expect(parseQuery('test')).toEqual({
      query: '',
      regexp: '(?i)test',
    });
  });

  it('returns query for strings without regexp', () => {
    expect(parseQuery('{foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '',
    });
  });

  it('returns query for strings with query and search string', () => {
    expect(parseQuery('x {foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)x',
    });
  });

  it('returns query for strings with query and regexp', () => {
    expect(parseQuery('{foo="bar"} x|y')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)x|y',
    });
  });

  it('returns query for selector with two labels', () => {
    expect(parseQuery('{foo="bar", baz="42"}')).toEqual({
      query: '{foo="bar", baz="42"}',
      regexp: '',
    });
  });

  it('returns query and regexp with quantifiers', () => {
    expect(parseQuery('{foo="bar"} \\.java:[0-9]{1,5}')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)\\.java:[0-9]{1,5}',
    });
    expect(parseQuery('\\.java:[0-9]{1,5} {foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      regexp: '(?i)\\.java:[0-9]{1,5}',
    });
  });
});
