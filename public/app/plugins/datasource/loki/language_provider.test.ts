// @ts-ignore
import Plain from 'slate-plain-serializer';

import LanguageProvider, { LABEL_REFRESH_INTERVAL, rangeToParams } from './language_provider';
import { AbsoluteTimeRange } from '@grafana/data';
import { advanceTo, clear, advanceBy } from 'jest-date-mock';
import { beforeEach } from 'test/lib/common';
import { DataQueryResponseData } from '@grafana/ui';

describe('Language completion provider', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] as DataQueryResponseData[] } }),
  };

  const rangeMock: AbsoluteTimeRange = {
    from: 1560153109000,
    to: 1560163909000,
  };

  describe('empty query suggestions', () => {
    it('returns no suggestions on empty context', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions.length).toEqual(0);
    });

    it('returns default suggestions with history on empty context when history was provided', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const history = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
        },
      ];
      const result = instance.provideCompletionItems(
        { text: '', prefix: '', value, wrapperClasses: [] },
        { history, absoluteRange: rangeMock }
      );
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toMatchObject([
        {
          label: 'History',
          items: [
            {
              label: '{app="foo"}',
            },
          ],
        },
      ]);
    });

    it('returns no suggestions within regexp', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('{} ()');
      const range = value.selection.merge({
        anchorOffset: 4,
      });
      const valueWithSelection = value.change().select(range).value;
      const history = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
        },
      ];
      const result = instance.provideCompletionItems(
        {
          text: '',
          prefix: '',
          value: valueWithSelection,
          wrapperClasses: [],
        },
        { history }
      );
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions.length).toEqual(0);
    });
  });

  describe('label suggestions', () => {
    it('returns default label suggestions on label context', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('{}');
      const range = value.selection.merge({
        anchorOffset: 1,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.provideCompletionItems(
        {
          text: '',
          prefix: '',
          wrapperClasses: ['context-labels'],
          value: valueWithSelection,
        },
        { absoluteRange: rangeMock }
      );
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'namespace' }], label: 'Labels' }]);
    });
  });
});

describe('Request URL', () => {
  it('should contain range params', async () => {
    const rangeMock: AbsoluteTimeRange = {
      from: 1560153109000,
      to: 1560163909000,
    };

    const datasourceWithLabels = {
      metadataRequest: url => {
        if (url.slice(0, 15) === '/api/prom/label') {
          return { data: { data: ['other'] } };
        } else {
          return { data: { data: [] } };
        }
      },
    };

    const datasourceSpy = jest.spyOn(datasourceWithLabels, 'metadataRequest');

    const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
    await instance.refreshLogLabels(rangeMock, true);
    const expectedUrl = '/api/prom/label';
    expect(datasourceSpy).toHaveBeenCalledWith(expectedUrl, rangeToParams(rangeMock));
  });
});

describe('Query imports', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] as DataQueryResponseData[] } }),
  };

  const rangeMock: AbsoluteTimeRange = {
    from: 1560153109000,
    to: 1560163909000,
  };

  it('returns empty queries for unknown origin datasource', async () => {
    const instance = new LanguageProvider(datasource, { initialRange: rangeMock });
    const result = await instance.importQueries([{ refId: 'bar', expr: 'foo' }], 'unknown');
    expect(result).toEqual([{ refId: 'bar', expr: '' }]);
  });

  describe('prometheus query imports', () => {
    it('returns empty query from metric-only query', async () => {
      const instance = new LanguageProvider(datasource, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('foo');
      expect(result).toEqual('');
    });

    it('returns empty query from selector query if label is not available', async () => {
      const datasourceWithLabels = {
        metadataRequest: url =>
          url.slice(0, 15) === '/api/prom/label'
            ? { data: { data: ['other'] } }
            : { data: { data: [] as DataQueryResponseData[] } },
      };
      const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('{foo="bar"}');
      expect(result).toEqual('{}');
    });

    it('returns selector query from selector query with common labels', async () => {
      const datasourceWithLabels = {
        metadataRequest: url =>
          url.slice(0, 15) === '/api/prom/label'
            ? { data: { data: ['foo'] } }
            : { data: { data: [] as DataQueryResponseData[] } },
      };
      const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{foo="bar"}');
    });

    it('returns selector query from selector query with all labels if logging label list is empty', async () => {
      const datasourceWithLabels = {
        metadataRequest: url =>
          url.slice(0, 15) === '/api/prom/label'
            ? { data: { data: [] as DataQueryResponseData[] } }
            : { data: { data: [] as DataQueryResponseData[] } },
      };
      const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{baz="42",foo="bar"}');
    });
  });
});

describe('Labels refresh', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] as DataQueryResponseData[] } }),
  };
  const instance = new LanguageProvider(datasource);

  const rangeMock: AbsoluteTimeRange = {
    from: 1560153109000,
    to: 1560163909000,
  };

  beforeEach(() => {
    instance.fetchLogLabels = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    clear();
  });

  it("should not refresh labels if refresh interval hasn't passed", () => {
    advanceTo(new Date(2019, 1, 1, 0, 0, 0));
    instance.logLabelFetchTs = Date.now();
    advanceBy(LABEL_REFRESH_INTERVAL / 2);
    instance.refreshLogLabels(rangeMock);
    expect(instance.fetchLogLabels).not.toBeCalled();
  });

  it('should refresh labels if refresh interval passed', () => {
    advanceTo(new Date(2019, 1, 1, 0, 0, 0));
    instance.logLabelFetchTs = Date.now();
    advanceBy(LABEL_REFRESH_INTERVAL + 1);
    instance.refreshLogLabels(rangeMock);
    expect(instance.fetchLogLabels).toBeCalled();
  });
});
