import { DataSourceInstanceSettings, PluginMetaInfo, PluginType } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { defaultParcaQueryType } from './dataquery.gen';
import { ParcaDataSource } from './datasource';
import { Query } from './types';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => {
      return {
        replace: (query: string): string => {
          return query.replace(/\$var/g, 'interpolated');
        },
      };
    },
  };
});

describe('Parca data source', () => {
  let ds: ParcaDataSource;
  beforeEach(() => {
    ds = new ParcaDataSource(defaultSettings);
  });

  describe('applyTemplateVariables', () => {
    const templateSrv = getTemplateSrv();

    it('should not update labelSelector if there are no template variables', () => {
      ds = new ParcaDataSource(defaultSettings, templateSrv);
      const query = ds.applyTemplateVariables(defaultQuery({ labelSelector: `no var` }), {});
      expect(query).toMatchObject({ labelSelector: `no var` });
    });

    it('should update labelSelector if there are template variables', () => {
      ds = new ParcaDataSource(defaultSettings, templateSrv);
      const query = ds.applyTemplateVariables(defaultQuery({ labelSelector: `{$var="$var"}` }), {});
      expect(query).toMatchObject({ labelSelector: `{interpolated="interpolated"}` });
    });
  });
});

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: 'parca',
  type: 'profiling',
  name: 'parca',
  access: 'proxy',
  meta: {
    id: 'parca',
    name: 'parca',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
  readOnly: false,
};

const defaultQuery = (query: Partial<Query>): Query => {
  return {
    refId: 'x',
    labelSelector: '',
    profileTypeId: '',
    queryType: defaultParcaQueryType,
    ...query,
  };
};
