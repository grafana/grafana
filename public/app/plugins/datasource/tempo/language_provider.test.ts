import { v1Tags, v2Tags } from './SearchTraceQLEditor/utils.test';
import { TraceqlSearchScope } from './dataquery.gen';
import { TempoDatasource } from './datasource';
import TempoLanguageProvider from './language_provider';
import { Scope } from './types';

describe('Language_provider', () => {
  describe('should get correct tags', () => {
    it('for API v1 tags', async () => {
      const lp = setup(v1Tags);
      const tags = lp.getTags();
      expect(tags).toEqual(['bar', 'foo', 'status']);
    });

    it('for API v2 resource tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTags(TraceqlSearchScope.Resource);
      expect(tags).toEqual(['cluster', 'container']);
    });

    it('for API v2 span tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTags(TraceqlSearchScope.Span);
      expect(tags).toEqual(['db']);
    });

    it('for API v2 unscoped tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTags(TraceqlSearchScope.Unscoped);
      expect(tags).toEqual(['cluster', 'container', 'db']);
    });
  });

  describe('should get correct traceql autocomplete tags', () => {
    it('for API v1 tags', async () => {
      const lp = setup(v1Tags);
      const tags = lp.getTraceqlAutocompleteTags();
      expect(tags).toEqual(['bar', 'foo', 'status']);
    });

    it('for API v2 resource tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Resource);
      expect(tags).toEqual(['cluster', 'container']);
    });

    it('for API v2 span tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Span);
      expect(tags).toEqual(['db']);
    });

    it('for API v2 unscoped tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTraceqlAutocompleteTags(TraceqlSearchScope.Unscoped);
      expect(tags).toEqual(['cluster', 'container', 'db']);
    });

    it('for API v2 tags with no scope', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getTraceqlAutocompleteTags();
      expect(tags).toEqual(['cluster', 'container', 'db']);
    });
  });

  describe('should get correct autocomplete tags', () => {
    it('for API v1 tags', async () => {
      const lp = setup(v1Tags);
      const tags = lp.getAutocompleteTags();
      expect(tags).toEqual(['bar', 'foo', 'status', 'status.code']);
    });

    it('for API v2 tags', async () => {
      const lp = setup(undefined, v2Tags);
      const tags = lp.getAutocompleteTags();
      expect(tags).toEqual(['cluster', 'container', 'db', 'duration', 'kind', 'name', 'status']);
    });
  });

  const setup = (tagsV1?: string[], tagsV2?: Scope[]) => {
    const datasource: TempoDatasource = {
      search: {
        filters: [],
      },
    } as unknown as TempoDatasource;

    const lp = new TempoLanguageProvider(datasource);
    if (tagsV1) {
      lp.setV1Tags(tagsV1);
    } else if (tagsV2) {
      lp.setV2Tags(tagsV2);
    }
    datasource.languageProvider = lp;

    return lp;
  };
});
