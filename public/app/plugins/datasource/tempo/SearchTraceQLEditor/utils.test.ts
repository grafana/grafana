import { uniq } from 'lodash';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { intrinsics } from '../traceql/traceql';

import { emptyTags, testIntrinsics, v1Tags, v2Tags } from './mocks';
import {
  filterToQuerySection,
  getAllTags,
  getFilteredTags,
  getIntrinsicTags,
  getTagsByScope,
  getUnscopedTags,
} from './utils';

const datasource: TempoDatasource = {
  search: {
    filters: [],
  },
} as unknown as TempoDatasource;
const lp = new TempoLanguageProvider(datasource);

describe('gets correct tags', () => {
  const datasource: TempoDatasource = {
    search: {
      filters: [],
    },
  } as unknown as TempoDatasource;
  const lp = new TempoLanguageProvider(datasource);

  it('for filtered tags when no tags supplied', () => {
    const tags = getFilteredTags(emptyTags, []);
    expect(tags).toEqual([]);
  });

  it('for filtered tags when API v1 tags supplied', () => {
    const tags = getFilteredTags(v1Tags, []);
    expect(tags).toEqual(['bar', 'foo']);
  });

  it('for filtered tags when API v1 tags supplied with tags to filter out', () => {
    const tags = getFilteredTags(v1Tags, ['foo']);
    expect(tags).toEqual(['bar']);
  });

  it('for filtered tags when API v2 tags supplied', () => {
    const tags = getFilteredTags(uniq(getUnscopedTags(v2Tags)), []);
    expect(tags).toEqual(['cluster', 'container', 'db']);
  });

  it('for filtered tags when API v2 tags supplied with tags to filter out', () => {
    const tags = getFilteredTags(getUnscopedTags(v2Tags), ['cluster']);
    expect(tags).toEqual(['container', 'db']);
  });

  it('for filtered tags when API v2 tags set', () => {
    lp.setV2Tags(v2Tags);
    const tags = getFilteredTags(uniq(getUnscopedTags(v2Tags)), []);
    expect(tags).toEqual(['cluster', 'container', 'db']);
  });

  it('for unscoped tags', () => {
    const tags = getUnscopedTags(v2Tags);
    expect(tags).toEqual(['cluster', 'container', 'db']);
  });

  it('for all tags', () => {
    const tags = getAllTags(v2Tags);
    expect(tags).toEqual(uniq(['cluster', 'container', 'db', 'duration', 'kind', 'name', 'status'].concat(intrinsics)));
  });

  it('for tags by resource scope', () => {
    const tags = getTagsByScope(v2Tags, TraceqlSearchScope.Resource);
    expect(tags).toEqual(['cluster', 'container']);
  });

  it('for tags by span scope', () => {
    const tags = getTagsByScope(v2Tags, TraceqlSearchScope.Span);
    expect(tags).toEqual(['db']);
  });

  it('for intrinsic tags', () => {
    const tags = getIntrinsicTags(v2Tags);
    expect(tags).toEqual(testIntrinsics);
  });
});

describe('filterToQuerySection returns the correct query section for a filter', () => {
  it('filter with single value', () => {
    const filter: TraceqlFilter = { id: 'abc', tag: 'foo', operator: '=', value: 'bar' };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('.foo=bar');
  });

  it('filter with regex operator', () => {
    const filter: TraceqlFilter = { id: 'abc', tag: 'foo', operator: '=~', value: 'bar.*', valueType: 'string' };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('.foo=~"bar.*"');
  });

  it('filter with scope', () => {
    const filter: TraceqlFilter = {
      id: 'abc',
      tag: 'foo',
      operator: '=',
      value: 'bar',
      scope: TraceqlSearchScope.Resource,
    };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('resource.foo=bar');
  });

  it('filter with intrinsic tag', () => {
    const filter: TraceqlFilter = { id: 'abc', tag: 'duration', operator: '=', value: '100ms' };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('duration=100ms');
  });

  it('filter with multiple non-string values and scope', () => {
    const filter: TraceqlFilter = {
      id: 'abc',
      tag: 'foo',
      operator: '=',
      value: ['bar', 'baz'],
      scope: TraceqlSearchScope.Span,
    };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('(span.foo=bar || span.foo=baz)');
  });

  it('filter with multiple string values and scope', () => {
    const filter: TraceqlFilter = {
      id: 'abc',
      tag: 'foo',
      operator: '=',
      value: ['bar', 'baz'],
      scope: TraceqlSearchScope.Span,
      valueType: 'string',
    };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('(span.foo="bar" || span.foo="baz")');
  });

  it('filter with multiple string values with regex', () => {
    const filter: TraceqlFilter = {
      id: 'abc',
      tag: 'foo',
      operator: '=~',
      value: ['bar', 'baz'],
      scope: TraceqlSearchScope.Span,
      valueType: 'string',
    };
    const result = filterToQuerySection(filter, [], lp);
    expect(result).toBe('span.foo=~"bar|baz"');
  });
});
