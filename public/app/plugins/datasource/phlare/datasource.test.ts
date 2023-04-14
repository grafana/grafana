import { AbstractLabelOperator, DataSourceInstanceSettings, PluginMetaInfo, PluginType } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { defaultPhlareQueryType } from './dataquery.gen';
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

  describe('applyTemplateVariables', () => {
    const interpolationVar = '$interpolationVar';
    const interpolationText = 'interpolationText';
    const noInterpolation = 'noInterpolation';

    it('should not update labelSelector if there are no template variables', () => {
      const templateSrv = new TemplateSrv();
      templateSrv.replace = jest.fn((query: string): string => {
        return query.replace(/\$interpolationVar/g, interpolationText);
      });
      ds = new PhlareDataSource(defaultSettings, templateSrv);
      const query = ds.applyTemplateVariables(defaultQuery(`{${noInterpolation}}`), {});
      expect(templateSrv.replace).toBeCalledTimes(1);
      expect(query.labelSelector).toBe(`{${noInterpolation}}`);
    });

    it('should update labelSelector if there are template variables', () => {
      const templateSrv = new TemplateSrv();
      templateSrv.replace = jest.fn((query: string): string => {
        return query.replace(/\$interpolationVar/g, interpolationText);
      });
      ds = new PhlareDataSource(defaultSettings, templateSrv);
      const query = ds.applyTemplateVariables(defaultQuery(`{${interpolationVar}="${interpolationVar}"}`), {
        interpolationVar: { text: interpolationText, value: interpolationText },
      });
      expect(templateSrv.replace).toBeCalledTimes(1);
      expect(query.labelSelector).toBe(`{${interpolationText}="${interpolationText}"}`);
    });
  });
});

const defaultQuery = (query: string) => {
  return {
    refId: 'x',
    groupBy: [],
    labelSelector: query,
    profileTypeId: '',
    queryType: defaultPhlareQueryType,
  };
};

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
