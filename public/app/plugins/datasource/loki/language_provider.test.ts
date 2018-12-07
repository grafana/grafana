import Plain from 'slate-plain-serializer';

import LanguageProvider from './language_provider';

describe('Language completion provider', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] } }),
  };

  describe('empty query suggestions', () => {
    it('returns no suggestions on emtpty context', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const result = instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions.length).toEqual(0);
    });

    it('returns default suggestions with history on emtpty context when history was provided', () => {
      const instance = new LanguageProvider(datasource);
      const value = Plain.deserialize('');
      const history = [
        {
          query: { refId: '1', expr: '{app="foo"}' },
        },
      ];
      const result = instance.provideCompletionItems({ text: '', prefix: '', value, wrapperClasses: [] }, { history });
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
      const result = instance.provideCompletionItems({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'namespace' }], label: 'Labels' }]);
    });
  });
});

describe('Query imports', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] } }),
  };

  it('returns empty queries for unknown origin datasource', async () => {
    const instance = new LanguageProvider(datasource);
    const result = await instance.importQueries([{ refId: 'bar', expr: 'foo' }], 'unknown');
    expect(result).toEqual([{ refId: 'bar', expr: '' }]);
  });

  describe('prometheus query imports', () => {
    it('returns empty query from metric-only query', async () => {
      const instance = new LanguageProvider(datasource);
      const result = await instance.importPrometheusQuery('foo');
      expect(result).toEqual('');
    });

    it('returns empty query from selector query if label is not available', async () => {
      const datasourceWithLabels = {
        metadataRequest: url => (url === '/api/prom/label' ? { data: { data: ['other'] } } : { data: { data: [] } }),
      };
      const instance = new LanguageProvider(datasourceWithLabels);
      const result = await instance.importPrometheusQuery('{foo="bar"}');
      expect(result).toEqual('{}');
    });

    it('returns selector query from selector query with common labels', async () => {
      const datasourceWithLabels = {
        metadataRequest: url => (url === '/api/prom/label' ? { data: { data: ['foo'] } } : { data: { data: [] } }),
      };
      const instance = new LanguageProvider(datasourceWithLabels);
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{foo="bar"}');
    });

    it('returns selector query from selector query with all labels if logging label list is empty', async () => {
      const datasourceWithLabels = {
        metadataRequest: url => (url === '/api/prom/label' ? { data: { data: [] } } : { data: { data: [] } }),
      };
      const instance = new LanguageProvider(datasourceWithLabels);
      const result = await instance.importPrometheusQuery('metric{foo="bar",baz="42"}');
      expect(result).toEqual('{baz="42",foo="bar"}');
    });
  });
});
