import { uniq } from 'lodash';

import { TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { intrinsicsV1 } from '../traceql/traceql';

import {
  generateQueryFromFilters,
  getUnscopedTags,
  getFilteredTags,
  getAllTags,
  getTagsByScope,
  generateQueryFromAdHocFilters,
} from './utils';

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

  describe('generates correct query for duration when duration type', () => {
    it('not set', () => {
      expect(
        generateQueryFromFilters([
          { id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration', value: '100ms' },
        ])
      ).toBe('{duration>100ms}');
    });
    it('set to span', () => {
      expect(
        generateQueryFromFilters([
          { id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration', value: '100ms' },
          { id: 'duration-type', value: 'span' },
        ])
      ).toBe('{duration>100ms}');
    });
    it('set to trace', () => {
      expect(
        generateQueryFromFilters([
          { id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration', value: '100ms' },
          { id: 'duration-type', value: 'trace' },
        ])
      ).toBe('{traceDuration>100ms}');
    });
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

describe('generateQueryFromAdHocFilters generates the correct query for', () => {
  it('an empty array', () => {
    expect(generateQueryFromAdHocFilters([])).toBe('{}');
  });

  it('a filter with values', () => {
    expect(generateQueryFromAdHocFilters([{ key: 'footag', operator: '=', value: 'foovalue' }])).toBe(
      '{footag="foovalue"}'
    );
  });

  it('two filters with values', () => {
    expect(
      generateQueryFromAdHocFilters([
        { key: 'footag', operator: '=', value: 'foovalue' },
        { key: 'bartag', operator: '=', value: '0' },
      ])
    ).toBe('{footag="foovalue" && bartag=0}');
  });

  it('a filter with intrinsic values', () => {
    expect(generateQueryFromAdHocFilters([{ key: 'kind', operator: '=', value: 'server' }])).toBe('{kind=server}');
  });
});

describe('gets correct tags', () => {
  const datasource: TempoDatasource = {
    search: {
      filters: [],
    },
  } as unknown as TempoDatasource;
  const lp = new TempoLanguageProvider(datasource);

  it('for filtered tags when no tags supplied', () => {
    const tags = getFilteredTags(emptyTags, lp, []);
    expect(tags).toEqual(intrinsicsV1);
  });

  it('for filtered tags when API v1 tags supplied', () => {
    const tags = getFilteredTags(v1Tags, lp, []);
    expect(tags).toEqual(intrinsicsV1.concat(['bar', 'foo']));
  });

  it('for filtered tags when API v1 tags supplied with tags to filter out', () => {
    const tags = getFilteredTags(v1Tags, lp, ['duration']);
    expect(tags).toEqual(intrinsicsV1.filter((x) => x !== 'duration').concat(['bar', 'foo']));
  });

  it('for filtered tags when API v2 tags supplied', () => {
    const tags = getFilteredTags(uniq(getUnscopedTags(v2Tags)), lp, []);
    expect(tags).toEqual(intrinsicsV1.concat(['cluster', 'container', 'db']));
  });

  it('for filtered tags when API v2 tags supplied with tags to filter out', () => {
    const tags = getFilteredTags(getUnscopedTags(v2Tags), lp, ['duration', 'cluster']);
    expect(tags).toEqual(intrinsicsV1.filter((x) => x !== 'duration').concat(['container', 'db']));
  });

  it('for filtered tags when API v2 tags set', () => {
    lp.setV2Tags(v2Tags);
    const tags = getFilteredTags(uniq(getUnscopedTags(v2Tags)), lp, []);
    expect(tags).toEqual(testIntrinsics.concat(['cluster', 'container', 'db']));
  });

  it('for unscoped tags', () => {
    const tags = getUnscopedTags(v2Tags);
    expect(tags).toEqual(['cluster', 'container', 'db']);
  });

  it('for all tags', () => {
    const tags = getAllTags(v2Tags);
    expect(tags).toEqual(['cluster', 'container', 'db', 'duration', 'kind', 'name', 'status']);
  });

  it('for tags by resource scope', () => {
    const tags = getTagsByScope(v2Tags, TraceqlSearchScope.Resource);
    expect(tags).toEqual(['cluster', 'container']);
  });

  it('for tags by span scope', () => {
    const tags = getTagsByScope(v2Tags, TraceqlSearchScope.Span);
    expect(tags).toEqual(['db']);
  });
});

export const emptyTags = [];
export const testIntrinsics = ['duration', 'kind', 'name', 'status'];
export const v1Tags = ['bar', 'foo'];
export const v2Tags = [
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
    tags: testIntrinsics,
  },
];
