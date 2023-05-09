import { TraceqlSearchScope } from '../dataquery.gen';
import { defaultTags, emptyTags, v2Tags } from '../traceql/autocomplete.test';

import { generateQueryFromFilters, getFilteredTags, getUnscopedTags } from './utils';

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
      '{.footag=foovalue}'
    );
    expect(
      generateQueryFromFilters([{ id: 'foo', tag: 'footag', value: 'foovalue', operator: '=', valueType: 'string' }])
    ).toBe('{.footag="foovalue"}');
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

describe('gets correct filtered tags', () => {
  it('when no tags supplied', () => {
    const tags = getFilteredTags(emptyTags, []);
    expect(tags).toEqual({ v1: ['duration', 'kind', 'name', 'status'], v2: [] });
  });

  it('when API v1 tags supplied', () => {
    const tags = getFilteredTags(defaultTags, []);
    expect(tags).toEqual({ v1: ['duration', 'kind', 'name', 'status', 'bar', 'foo'], v2: undefined });
  });

  it('when API v1 tags supplied with tags to filter out', () => {
    const tags = getFilteredTags(defaultTags, ['duration']);
    expect(tags).toEqual({ v1: ['kind', 'name', 'status', 'bar', 'foo'], v2: undefined });
  });

  it('when API v2 tags supplied', () => {
    const tags = getFilteredTags(v2Tags, []);
    expect(tags).toEqual({
      v1: undefined,
      v2: [
        {
          name: 'resource',
          tags: ['duration', 'kind', 'name', 'status', 'cluster', 'container'],
        },
        {
          name: 'span',
          tags: ['duration', 'kind', 'name', 'status', 'db'],
        },
        {
          name: 'intrinsic',
          tags: ['duration', 'kind', 'name', 'status'],
        },
      ],
    });
  });

  it('when API v2 tags supplied with tags to filter out', () => {
    const tags = getFilteredTags(v2Tags, ['duration', 'cluster']);
    expect(tags).toEqual({
      v1: undefined,
      v2: [
        {
          name: 'resource',
          tags: ['kind', 'name', 'status', 'container'],
        },
        {
          name: 'span',
          tags: ['kind', 'name', 'status', 'db'],
        },
        {
          name: 'intrinsic',
          tags: ['duration', 'kind', 'name', 'status'],
        },
      ],
    });
  });
});

describe('gets correct unscoped tags', () => {
  const scopes = [
    {
      name: 'resource',
      tags: ['cluster', 'container'],
    },
    {
      name: 'span',
      tags: ['db'],
    },
    {
      name: 'intrinsic',
      tags: ['duration', 'name'],
    },
  ];
  const tags = getUnscopedTags(scopes);
  expect(tags).toEqual(['cluster', 'container', 'db']);
});
