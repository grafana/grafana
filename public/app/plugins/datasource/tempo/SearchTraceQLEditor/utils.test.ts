import { uniq } from 'lodash';

import { TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { intrinsicsV1 } from '../traceql/traceql';

import { getUnscopedTags, getFilteredTags, getAllTags, getTagsByScope, generateQueryFromAdHocFilters } from './utils';

const datasource: TempoDatasource = {
  search: {
    filters: [],
  },
} as unknown as TempoDatasource;
const lp = new TempoLanguageProvider(datasource);

describe('generateQueryFromAdHocFilters generates the correct query for', () => {
  it('an empty array', () => {
    expect(generateQueryFromAdHocFilters([], lp)).toBe('{}');
  });

  it('a filter with values', () => {
    expect(generateQueryFromAdHocFilters([{ key: 'footag', operator: '=', value: 'foovalue' }], lp)).toBe(
      '{footag="foovalue"}'
    );
  });

  it('two filters with values', () => {
    expect(
      generateQueryFromAdHocFilters(
        [
          { key: 'footag', operator: '=', value: 'foovalue' },
          { key: 'bartag', operator: '=', value: '0' },
        ],
        lp
      )
    ).toBe('{footag="foovalue" && bartag=0}');
  });

  it('a filter with intrinsic values', () => {
    expect(generateQueryFromAdHocFilters([{ key: 'kind', operator: '=', value: 'server' }], lp)).toBe('{kind=server}');
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
