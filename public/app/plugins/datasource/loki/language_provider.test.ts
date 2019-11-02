import Plain from 'slate-plain-serializer';
import { Editor as SlateEditor } from 'slate';

import LanguageProvider, { LABEL_REFRESH_INTERVAL, LokiHistoryItem, rangeToParams } from './language_provider';
import { AbsoluteTimeRange } from '@grafana/data';
import { TypeaheadInput } from '@grafana/ui';
import { advanceTo, clear, advanceBy } from 'jest-date-mock';
import { beforeEach } from 'test/lib/common';

import { makeMockLokiDatasource } from './mocks';
import LokiDatasource from './datasource';

describe('Language completion provider', () => {
  const datasource = makeMockLokiDatasource({});

  const rangeMock: AbsoluteTimeRange = {
    from: 1560153109000,
    to: 1560163909000,
  };

  describe('empty query suggestions', () => {
    it('returns no suggestions on empty context', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = await instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();

      expect(result.suggestions.length).toEqual(0);
    });

    it('returns default suggestions with history on empty context when history was provided', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const history: LokiHistoryItem[] = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
          ts: 1,
        },
      ];
      const result = await instance.provideCompletionItems(
        { text: '', prefix: '', value, wrapperClasses: [] },
        { history, absoluteRange: rangeMock }
      );
      expect(result.context).toBeUndefined();

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

    it('returns no suggestions within regexp', async () => {
      const instance = new LanguageProvider(datasource);
      const input = createTypeaheadInput('{} ()', '', undefined, 4, []);
      const history: LokiHistoryItem[] = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
          ts: 1,
        },
      ];
      const result = await instance.provideCompletionItems(input, { history });
      expect(result.context).toBeUndefined();

      expect(result.suggestions.length).toEqual(0);
    });
  });

  describe('label suggestions', () => {
    it('returns default label suggestions on label context', async () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('{}');
      const ed = new SlateEditor({ value });
      const valueWithSelection = ed.moveForward(1).value;
      const result = await instance.provideCompletionItems(
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

    it('returns label suggestions from Loki', async () => {
      const datasource = makeMockLokiDatasource({ label1: [], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{}', '');
      const result = await provider.provideCompletionItems(input, { absoluteRange: rangeMock });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'label1' }, { label: 'label2' }], label: 'Labels' }]);
    });

    it('returns label values suggestions from Loki', async () => {
      const datasource = makeMockLokiDatasource({ label1: ['label1_val1', 'label1_val2'], label2: [] });
      const provider = await getLanguageProvider(datasource);
      const input = createTypeaheadInput('{label1=}', '=', 'label1');
      let result = await provider.provideCompletionItems(input, { absoluteRange: rangeMock });

      result = await provider.provideCompletionItems(input, { absoluteRange: rangeMock });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        { items: [{ label: 'label1_val1' }, { label: 'label1_val2' }], label: 'Label values for "label1"' },
      ]);
    });
  });
});

describe('Request URL', () => {
  it('should contain range params', async () => {
    const rangeMock: AbsoluteTimeRange = {
      from: 1560153109000,
      to: 1560163909000,
    };

    const datasourceWithLabels = makeMockLokiDatasource({ other: [] });
    const datasourceSpy = jest.spyOn(datasourceWithLabels as any, 'metadataRequest');

    const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
    await instance.refreshLogLabels(rangeMock, true);
    const expectedUrl = '/api/prom/label';
    expect(datasourceSpy).toHaveBeenCalledWith(expectedUrl, rangeToParams(rangeMock));
  });
});

describe('Query imports', () => {
  const datasource = makeMockLokiDatasource({});

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
      const datasourceWithLabels = makeMockLokiDatasource({ other: [] });
      const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('{foo="bar"}');
      expect(result).toEqual('{}');
    });

    it('returns selector query from selector query with common labels', async () => {
      const datasourceWithLabels = makeMockLokiDatasource({ foo: [] });
      const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{foo="bar"}');
    });

    it('returns selector query from selector query with all labels if logging label list is empty', async () => {
      const datasourceWithLabels = makeMockLokiDatasource({});
      const instance = new LanguageProvider(datasourceWithLabels, { initialRange: rangeMock });
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{baz="42",foo="bar"}');
    });
  });
});

describe('Labels refresh', () => {
  const datasource = makeMockLokiDatasource({});
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

async function getLanguageProvider(datasource: LokiDatasource) {
  const instance = new LanguageProvider(datasource);
  instance.initialRange = {
    from: Date.now() - 10000,
    to: Date.now(),
  };
  await instance.start();
  return instance;
}

/**
 * @param value Value of the full input
 * @param text Last piece of text (not sure but in case of {label=} this would be just '=')
 * @param labelKey Label by which to search for values. Cutting corners a bit here as this should be inferred from value
 */
function createTypeaheadInput(
  value: string,
  text: string,
  labelKey?: string,
  anchorOffset?: number,
  wrapperClasses?: string[]
): TypeaheadInput {
  const deserialized = Plain.deserialize(value);
  const range = deserialized.selection.setAnchor(deserialized.selection.anchor.setOffset(anchorOffset || 1));
  const valueWithSelection = deserialized.setSelection(range);
  return {
    text,
    prefix: '',
    wrapperClasses: wrapperClasses || ['context-labels'],
    value: valueWithSelection,
    labelKey,
  };
}
