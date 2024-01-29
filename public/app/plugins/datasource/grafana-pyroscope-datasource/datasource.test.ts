import {
  AbstractLabelOperator,
  CoreApp,
  DataSourceInstanceSettings,
  PluginMetaInfo,
  PluginType,
  DataSourceJsonData,
} from '@grafana/data';
import { setPluginExtensionGetter, getBackendSrv, setBackendSrv, getTemplateSrv } from '@grafana/runtime';

import { defaultPyroscopeQueryType } from './dataquery.gen';
import { normalizeQuery, PyroscopeDataSource } from './datasource';
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

/** The datasource QueryEditor fetches datasource settings to send to the extension's `configure` method */
export function mockFetchPyroscopeDatasourceSettings(
  datasourceSettings?: Partial<DataSourceInstanceSettings<DataSourceJsonData>>
) {
  const settings = { ...defaultSettings, ...datasourceSettings };
  const returnValues: Record<string, unknown> = {
    [`/api/datasources/uid/${settings.uid}`]: settings,
  };
  setBackendSrv({
    ...getBackendSrv(),
    get: function <T>(path: string) {
      const value = returnValues[path];
      if (value) {
        return Promise.resolve(value as T);
      }
      return Promise.reject({ message: 'reject' });
    },
  });
}

describe('Pyroscope data source', () => {
  let ds: PyroscopeDataSource;
  beforeEach(() => {
    mockFetchPyroscopeDatasourceSettings();
    setPluginExtensionGetter(() => ({ extensions: [] })); // No extensions
    ds = new PyroscopeDataSource(defaultSettings);
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
    const templateSrv = getTemplateSrv();

    it('should not update labelSelector if there are no template variables', () => {
      ds = new PyroscopeDataSource(defaultSettings, templateSrv);
      const query = ds.applyTemplateVariables(defaultQuery({ labelSelector: `no var`, profileTypeId: 'no var' }), {});
      expect(query).toMatchObject({
        labelSelector: `no var`,
        profileTypeId: 'no var',
      });
    });

    it('should update labelSelector if there are template variables', () => {
      ds = new PyroscopeDataSource(defaultSettings, templateSrv);
      const query = ds.applyTemplateVariables(
        defaultQuery({ labelSelector: `{$var="$var"}`, profileTypeId: '$var' }),
        {}
      );
      expect(query).toMatchObject({ labelSelector: `{interpolated="interpolated"}`, profileTypeId: 'interpolated' });
    });
  });
});

describe('normalizeQuery', () => {
  it('correctly normalizes the query', () => {
    // We need the type assertion here because the query types are inherently wrong in explore.
    let normalized = normalizeQuery({} as Query);
    expect(normalized).toMatchObject({
      labelSelector: '{}',
      groupBy: [],
      queryType: 'profile',
    });

    normalized = normalizeQuery({
      labelSelector: '{app="myapp"}',
      groupBy: ['app'],
      queryType: 'metrics',
      profileTypeId: 'cpu',
      refId: '',
    });
    expect(normalized).toMatchObject({
      labelSelector: '{app="myapp"}',
      groupBy: ['app'],
      queryType: 'metrics',
      profileTypeId: 'cpu',
    });
  });

  it('correctly normalizes the query when in explore', () => {
    // We need the type assertion here because the query types are inherently wrong in explore.
    const normalized = normalizeQuery({} as Query, CoreApp.Explore);
    expect(normalized).toMatchObject({
      labelSelector: '{}',
      groupBy: [],
      queryType: 'both',
    });
  });
});

const defaultQuery = (query: Partial<Query>): Query => {
  return {
    refId: 'x',
    groupBy: [],
    labelSelector: '',
    profileTypeId: '',
    queryType: defaultPyroscopeQueryType,
    ...query,
  };
};

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: 'pyroscope',
  type: 'profiling',
  name: 'pyroscope',
  access: 'proxy',
  meta: {
    id: 'pyroscope',
    name: 'pyroscope',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
  readOnly: false,
};
