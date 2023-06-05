import { TraceqlSearchScope } from '../dataquery.gen';

import { generateQueryFromFilters } from './utils';

describe('generateQueryFromFilters generates the correct query for', () => {
  it('an empty array', () => {
    expect(generateQueryFromFilters([])).toBe('{}');
  });

  it('a field without value', () => {
    expect(generateQueryFromFilters([{ id: 'foo', tag: 'footag', operator: '=' }])).toBe('{}');
  });

  it('a field with value but without tag', () => {
    expect(generateQueryFromFilters([{ id: 'foo', value: 'foovalue', operator: '=' }])).toBe('{}');
  });

  it('a field with value and tag but without operator', () => {
    expect(generateQueryFromFilters([{ id: 'foo', tag: 'footag', value: 'foovalue' }])).toBe('{}');
  });

  it('a field with tag, operator and tag', () => {
    expect(generateQueryFromFilters([{ id: 'foo', tag: 'footag', value: 'foovalue', operator: '=' }])).toBe(
      '{.footag="foovalue"}'
    );
  });

  it('a field with valueType as integer', () => {
    expect(
      generateQueryFromFilters([{ id: 'foo', tag: 'footag', value: '1234', operator: '>', valueType: 'integer' }])
    ).toBe('{.footag>1234}');
  });
  it('two fields with everything filled in', () => {
    expect(
      generateQueryFromFilters([
        { id: 'foo', tag: 'footag', value: '1234', operator: '>=', valueType: 'integer' },
        { id: 'bar', tag: 'bartag', value: 'barvalue', operator: '=', valueType: 'string' },
      ])
    ).toBe('{.footag>=1234 && .bartag="barvalue"}');
  });
  it('two fields but one is missing a value', () => {
    expect(
      generateQueryFromFilters([
        { id: 'foo', tag: 'footag', value: '1234', operator: '>=', valueType: 'integer' },
        { id: 'bar', tag: 'bartag', operator: '=', valueType: 'string' },
      ])
    ).toBe('{.footag>=1234}');
  });
  it('two fields but one is missing a value and the other a tag', () => {
    expect(
      generateQueryFromFilters([
        { id: 'foo', value: '1234', operator: '>=', valueType: 'integer' },
        { id: 'bar', tag: 'bartag', operator: '=', valueType: 'string' },
      ])
    ).toBe('{}');
  });
  it('scope is unscoped', () => {
    expect(
      generateQueryFromFilters([
        {
          id: 'foo',
          tag: 'footag',
          value: '1234',
          operator: '>=',
          scope: TraceqlSearchScope.Unscoped,
          valueType: 'integer',
        },
      ])
    ).toBe('{.footag>=1234}');
  });
  it('scope is span', () => {
    expect(
      generateQueryFromFilters([
        {
          id: 'foo',
          tag: 'footag',
          value: '1234',
          operator: '>=',
          scope: TraceqlSearchScope.Span,
          valueType: 'integer',
        },
      ])
    ).toBe('{span.footag>=1234}');
  });
  it('scope is resource', () => {
    expect(
      generateQueryFromFilters([
        {
          id: 'foo',
          tag: 'footag',
          value: '1234',
          operator: '>=',
          scope: TraceqlSearchScope.Resource,
          valueType: 'integer',
        },
      ])
    ).toBe('{resource.footag>=1234}');
  });
});
