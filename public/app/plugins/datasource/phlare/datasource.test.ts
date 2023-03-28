import { AbstractLabelOperator, DataSourceInstanceSettings, PluginMetaInfo, PluginType } from '@grafana/data';

import { PhlareDataSource } from './datasource';

describe('Phlare data source', () => {
  let ds: PhlareDataSource;
  beforeEach(() => {
    ds = new PhlareDataSource(defaultSettings);
  });

  describe('importing queries', () => {
    it('keeps all labels and values', async () => {
      const queries = await ds.importFromAbstractQueries([
        {
          refId: 'A',
          labelMatchers: [
            { name: 'foo', operator: AbstractLabelOperator.Equal, value: 'bar' },
            { name: 'foo2', operator: AbstractLabelOperator.Equal, value: 'bar2' },
          ],
        },
      ]);
      expect(queries[0].labelSelector).toBe('{foo="bar", foo2="bar2"}');
    });
  });

  describe('exporting queries', () => {
    it('keeps all labels and values', async () => {
      const queries = await ds.exportToAbstractQueries([
        {
          refId: 'A',
          labelSelector: '{foo="bar", foo2="bar2"}',
          queryType: 'both',
          profileTypeId: '',
          groupBy: [''],
        },
      ]);
      expect(queries).toMatchObject([
        {
          refId: 'A',
          labelMatchers: [
            { name: 'foo', operator: AbstractLabelOperator.Equal, value: 'bar' },
            { name: 'foo2', operator: AbstractLabelOperator.Equal, value: 'bar2' },
          ],
        },
      ]);
    });
  });
});

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: 'phlare',
  type: 'profiling',
  name: 'phlare',
  access: 'proxy',
  meta: {
    id: 'phlare',
    name: 'phlare',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
  readOnly: false,
};
