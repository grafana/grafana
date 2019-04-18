import { parseQuery } from './query_utils';

describe('parseQuery', () => {
  it('returns empty for empty string', () => {
    expect(parseQuery('')).toEqual({
      query: '',
      selector: '',
      filter: '',
    });
  });

  it('returns regexp for strings without query', () => {
    expect(parseQuery('test')).toEqual({
      query: 'test',
      selector: '',
      filter: 'test',
    });
  });

  it('returns query for strings without regexp', () => {
    expect(parseQuery('{foo="bar"}')).toEqual({
      query: '{foo="bar"}',
      selector: '{foo="bar"}',
      filter: '',
    });
  });

  it('returns query for strings with query and search string', () => {
    expect(parseQuery('x {foo="bar"}')).toEqual({
      query: '{foo="bar"} |~ "(?i)x"',
      selector: '{foo="bar"}',
      filter: 'x',
    });
  });

  it('returns query for strings with query and regexp', () => {
    expect(parseQuery('{foo="bar"} x|y')).toEqual({
      query: '{foo="bar"} |~ "(?i)x|y"',
      selector: '{foo="bar"}',
      filter: 'x|y',
    });
  });

  it('returns query for selector with two labels', () => {
    expect(parseQuery('{foo="bar", baz="42"}')).toEqual({
      query: '{foo="bar", baz="42"}',
      selector: '{foo="bar", baz="42"}',
      filter: '',
    });
  });

  it('returns query and regexp with quantifiers', () => {
    expect(parseQuery('{foo="bar"} \\.java:[0-9]{1,5}')).toEqual({
      query: '{foo="bar"} |~ "(?i)\\.java:[0-9]{1,5}"',
      selector: '{foo="bar"}',
      filter: '\\.java:[0-9]{1,5}',
    });
    expect(parseQuery('\\.java:[0-9]{1,5} {foo="bar"}')).toEqual({
      query: '{foo="bar"} |~ "(?i)\\.java:[0-9]{1,5}"',
      selector: '{foo="bar"}',
      filter: '\\.java:[0-9]{1,5}',
    });
  });

  it('returns query with filter operands as is', () => {
    expect(parseQuery('{foo="bar"} |= "x|y"')).toEqual({
      query: '{foo="bar"} |= "x|y"',
      selector: '{foo="bar"}',
      filter: '|= "x|y"',
    });
    expect(parseQuery('{foo="bar"} |~ "42"')).toEqual({
      query: '{foo="bar"} |~ "42"',
      selector: '{foo="bar"}',
      filter: '|~ "42"',
    });
  });
});
