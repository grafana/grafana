import { uniq } from 'lodash';

import { v2Tags } from './SearchTraceQLEditor/mocks';
import { TraceqlSearchScope } from './dataquery.gen';
import { TempoDatasource } from './datasource';
import TempoLanguageProvider from './language_provider';
import { intrinsics } from './traceql/traceql';
import { Scope } from './types';

describe('Language_provider', () => {
  describe('should get correct tags', () => {
    it('for API v2 resource tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTags(TraceqlSearchScope.Resource);
      expect(tags).toEqual(['cluster', 'container']);
    });

    it('for API v2 span tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTags(TraceqlSearchScope.Span);
      expect(tags).toEqual(['db']);
    });

    it('for API v2 unscoped tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTags(TraceqlSearchScope.Unscoped);
      expect(tags).toEqual(['cluster', 'container', 'db']);
    });
  });

  describe('should get correct traceql autocomplete tags', () => {
    it('for API v2 resource tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Resource);
      expect(tags).toEqual(['cluster', 'container']);
    });

    it('for API v2 span tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Span);
      expect(tags).toEqual(['db']);
    });

    it('for API v2 unscoped tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Unscoped);
      expect(tags).toEqual(['cluster', 'container', 'db']);
    });

    it('for API v2 tags with no scope', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getTraceqlAutocompleteTags();
      expect(tags).toEqual(['cluster', 'container', 'db']);
    });
  });

  describe('should get correct autocomplete tags', () => {
    it('for API v2 tags', async () => {
      const lp = setup(v2Tags);
      const tags = lp.getAutocompleteTags();
      expect(tags).toEqual(
        uniq(['cluster', 'container', 'db', 'duration', 'kind', 'name', 'status'].concat(intrinsics))
      );
    });
  });

  describe('generateQueryFromFilters generates the correct query for', () => {
    let lp: TempoLanguageProvider;
    beforeEach(() => {
      lp = setup(v2Tags);
    });

    it('an empty array', () => {
      expect(lp.generateQueryFromFilters({ traceqlFilters: [] })).toBe('{}');
    });

    it('a field without value', () => {
      expect(lp.generateQueryFromFilters({ traceqlFilters: [{ id: 'foo', tag: 'footag', operator: '=' }] })).toBe('{}');
    });

    it('a field with value but without tag', () => {
      expect(lp.generateQueryFromFilters({ traceqlFilters: [{ id: 'foo', value: 'foovalue', operator: '=' }] })).toBe(
        '{}'
      );
    });

    it('a field with value and tag but without operator', () => {
      expect(lp.generateQueryFromFilters({ traceqlFilters: [{ id: 'foo', tag: 'footag', value: 'foovalue' }] })).toBe(
        '{}'
      );
    });

    describe('generates correct query for duration when duration type', () => {
      it('not set', () => {
        expect(
          lp.generateQueryFromFilters({
            traceqlFilters: [
              { id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration', value: '100ms' },
            ],
          })
        ).toBe('{duration>100ms}');
      });
      it('set to span', () => {
        expect(
          lp.generateQueryFromFilters({
            traceqlFilters: [
              { id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration', value: '100ms' },
              { id: 'duration-type', value: 'span' },
            ],
          })
        ).toBe('{duration>100ms}');
      });
      it('set to trace', () => {
        expect(
          lp.generateQueryFromFilters({
            traceqlFilters: [
              { id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration', value: '100ms' },
              { id: 'duration-type', value: 'trace' },
            ],
          })
        ).toBe('{traceDuration>100ms}');
      });
    });

    it('a field with tag, operator and tag', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [{ id: 'foo', tag: 'footag', value: 'foovalue', operator: '=' }],
        })
      ).toBe('{.footag=foovalue}');
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [{ id: 'foo', tag: 'footag', value: 'foovalue', operator: '=', valueType: 'string' }],
        })
      ).toBe('{.footag="foovalue"}');
    });

    it('a field with valueType as integer', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [{ id: 'foo', tag: 'footag', value: '1234', operator: '>', valueType: 'integer' }],
        })
      ).toBe('{.footag>1234}');
    });
    it.each([['=~'], ['!~']])('a field with a regexp operator (%s)', (operator) => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            {
              id: 'span-name',
              tag: 'name',
              operator,
              scope: TraceqlSearchScope.Span,
              value: ['api/v2/variants/by-upc/(?P<upc>[\\s\\S]*)/$'],
              valueType: 'string',
            },
          ],
        })
      ).toBe(`{name${operator}"api/v2/variants/by-upc/\\\\(\\\\?P<upc>\\\\[\\\\s\\\\S\\\\]\\\\*\\\\)/\\\\$"}`);
    });
    it('two fields with everything filled in', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            { id: 'foo', tag: 'footag', value: '1234', operator: '>=', valueType: 'integer' },
            { id: 'bar', tag: 'bartag', value: 'barvalue', operator: '=', valueType: 'string' },
          ],
        })
      ).toBe('{.footag>=1234 && .bartag="barvalue"}');
    });
    it('two fields but one is missing a value', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            { id: 'foo', tag: 'footag', value: '1234', operator: '>=', valueType: 'integer' },
            { id: 'bar', tag: 'bartag', operator: '=', valueType: 'string' },
          ],
        })
      ).toBe('{.footag>=1234}');
    });
    it('two fields but one is missing a value and the other a tag', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            { id: 'foo', value: '1234', operator: '>=', valueType: 'integer' },
            { id: 'bar', tag: 'bartag', operator: '=', valueType: 'string' },
          ],
        })
      ).toBe('{}');
    });
    it('scope is unscoped', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            {
              id: 'foo',
              tag: 'footag',
              value: '1234',
              operator: '>=',
              scope: TraceqlSearchScope.Unscoped,
              valueType: 'integer',
            },
          ],
        })
      ).toBe('{.footag>=1234}');
    });
    it('scope is span', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            {
              id: 'foo',
              tag: 'footag',
              value: '1234',
              operator: '>=',
              scope: TraceqlSearchScope.Span,
              valueType: 'integer',
            },
          ],
        })
      ).toBe('{span.footag>=1234}');
    });
    it('scope is resource', () => {
      expect(
        lp.generateQueryFromFilters({
          traceqlFilters: [
            {
              id: 'foo',
              tag: 'footag',
              value: '1234',
              operator: '>=',
              scope: TraceqlSearchScope.Resource,
              valueType: 'integer',
            },
          ],
        })
      ).toBe('{resource.footag>=1234}');
    });
    describe('adhoc filters', () => {
      it('mixes adhoc filters with trace ql', () => {
        expect(
          lp.generateQueryFromFilters({
            traceqlFilters: [
              {
                id: 'foo',
                tag: 'footag',
                value: '1234',
                operator: '>=',
                scope: TraceqlSearchScope.Resource,
                valueType: 'integer',
              },
            ],
            adhocFilters: [
              {
                key: 'resource.name',
                operator: '=',
                value: 'foo',
              },
            ],
          })
        ).toBe('{resource.footag>=1234 && resource.name="foo"}');
      });
      it('an empty array', () => {
        expect(lp.generateQueryFromFilters({ adhocFilters: [] })).toBe('{}');
      });

      it('a filter with values', () => {
        expect(
          lp.generateQueryFromFilters({ adhocFilters: [{ key: 'footag', operator: '=', value: 'foovalue' }] })
        ).toBe('{footag="foovalue"}');
      });

      it('two filters with values', () => {
        expect(
          lp.generateQueryFromFilters({
            adhocFilters: [
              { key: 'footag', operator: '=', value: 'foovalue' },
              { key: 'bartag', operator: '=', value: '0' },
            ],
          })
        ).toBe('{footag="foovalue" && bartag=0}');
      });

      it('a filter with enum intrinsic values', () => {
        expect(lp.generateQueryFromFilters({ adhocFilters: [{ key: 'kind', operator: '=', value: 'server' }] })).toBe(
          '{kind=server}'
        );
      });

      it('a filter with non-enum intrinsic values', () => {
        expect(
          lp.generateQueryFromFilters({ adhocFilters: [{ key: 'name', operator: '=', value: 'my-server' }] })
        ).toBe('{name="my-server"}');
      });
    });
  });

  const setup = (tagsV2?: Scope[]) => {
    const datasource: TempoDatasource = {
      search: {
        filters: [],
      },
    } as unknown as TempoDatasource;

    const lp = new TempoLanguageProvider(datasource);
    if (tagsV2) {
      lp.setV2Tags(tagsV2);
    }
    datasource.languageProvider = lp;

    return lp;
  };
});
