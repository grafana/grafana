import {
  AbstractLabelOperator,
  CoreApp,
  DataSourceInstanceSettings,
  PluginMetaInfo,
  PluginType,
  DataSourceJsonData,
  makeTimeRange,
} from '@grafana/data';
import { setPluginExtensionsHook, getBackendSrv, setBackendSrv, TemplateSrv } from '@grafana/runtime';

import { defaultPyroscopeQueryType } from './dataquery.gen';
import { normalizeQuery, PyroscopeDataSource } from './datasource';
import { Query } from './types';

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

function setupDatasource() {
  mockFetchPyroscopeDatasourceSettings();
  setPluginExtensionsHook(() => ({ extensions: [], isLoading: false })); // No extensions
  const templateSrv = {
    replace: (query: string): string => {
      return query.replace(/\$var/g, 'interpolated');
    },
  } as unknown as TemplateSrv;
  return new PyroscopeDataSource(defaultSettings, templateSrv);
}

describe('Pyroscope data source', () => {
  describe('importing queries', () => {
    it('keeps all labels and values', async () => {
      const ds = setupDatasource();
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
      const ds = setupDatasource();
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
    it('should not update labelSelector if there are no template variables', () => {
      const ds = setupDatasource();
      const query = ds.applyTemplateVariables(defaultQuery({ labelSelector: `no var`, profileTypeId: 'no var' }), {});
      expect(query).toMatchObject({
        labelSelector: `no var`,
        profileTypeId: 'no var',
      });
    });

    it('should update labelSelector if there are template variables', () => {
      const ds = setupDatasource();
      const query = ds.applyTemplateVariables(
        defaultQuery({ labelSelector: `{$var="$var"}`, profileTypeId: '$var' }),
        {}
      );
      expect(query).toMatchObject({ labelSelector: `{interpolated="interpolated"}`, profileTypeId: 'interpolated' });
    });
  });

  it('implements ad hoc variable support for keys', async () => {
    const ds = setupDatasource();
    jest.spyOn(ds, 'getResource').mockImplementationOnce(async (cb) => ['foo', 'bar', 'baz']);
    const keys = await ds.getTagKeys({
      filters: [],
      timeRange: makeTimeRange('2024-01-01T00:00:00', '2024-01-01T01:00:00'),
    });
    expect(keys).toEqual(['foo', 'bar', 'baz'].map((v) => ({ text: v })));
  });

  it('implements ad hoc variable support for values', async () => {
    const ds = setupDatasource();
    jest.spyOn(ds, 'getResource').mockImplementationOnce(async (path, params) => {
      expect(params?.label).toEqual('foo');
      return ['xyz', 'tuv'];
    });
    const keys = await ds.getTagValues({
      key: 'foo',
      filters: [],
      timeRange: makeTimeRange('2024-01-01T00:00:00', '2024-01-01T01:00:00'),
    });
    expect(keys).toEqual(['xyz', 'tuv'].map((v) => ({ text: v })));
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
