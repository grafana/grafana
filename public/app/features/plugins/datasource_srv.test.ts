import { Observable, of } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePlugin,
  DataSourcePluginMeta,
  ScopedVars,
} from '@grafana/data';
import { RuntimeDataSource, TemplateSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { DatasourceSrv, getNameOrUid } from 'app/features/plugins/datasource_srv';

// Datasource variable $datasource with current value 'BBB'
const templateSrv = {
  getVariables: () => [
    {
      type: 'datasource',
      name: 'datasource',
      current: {
        value: 'BBB',
      },
    },
    {
      type: 'datasource',
      name: 'datasourceByUid',
      current: {
        value: 'uid-code-DDDD',
      },
    },
    {
      type: 'datasource',
      name: 'datasourceDefault',
      current: {
        value: 'default',
      },
    },
  ],
  replace: (v: string, scopedVars: ScopedVars) => {
    if (scopedVars && scopedVars.datasource) {
      return v.replace('${datasource}', scopedVars.datasource.value);
    }

    let result = v.replace('${datasource}', 'BBB');
    result = result.replace('${datasourceByUid}', 'DDDD');
    result = result.replace('${datasourceDefault}', 'default');
    return result;
  },
} as TemplateSrv;

class TestDataSource {
  constructor(public instanceSettings: DataSourceInstanceSettings) {}
}

class TestRuntimeDataSource extends RuntimeDataSource {
  query(request: DataQueryRequest<DataQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    return of({ data: [] });
  }
}

jest.mock('./pluginLoader', () => ({
  importDataSourcePlugin: (meta: DataSourcePluginMeta) => {
    return Promise.resolve(new DataSourcePlugin(TestDataSource as any));
  },
}));

const getBackendSrvGetMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: getBackendSrvGetMock,
  }),
}));

describe('datasource_srv', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const dataSourceSrv = new DatasourceSrv(templateSrv);
  const dataSourceInit = {
    mmm: {
      type: 'test-db',
      name: 'mmm',
      uid: 'uid-code-mmm',
      meta: { metrics: true, annotations: true },
    },
    '-- Grafana --': {
      type: 'datasource',
      name: '-- Grafana --',
      meta: { builtIn: true, metrics: true, id: 'grafana' },
    },
    '-- Dashboard --': {
      type: 'datasource',
      name: '-- Dashboard --',
      meta: { builtIn: true, metrics: true, id: 'dashboard' },
    },
    '-- Mixed --': {
      type: 'datasource',
      name: '-- Mixed --',
      meta: { builtIn: true, metrics: true, id: 'mixed' },
    },
    ZZZ: {
      type: 'test-db',
      name: 'ZZZ',
      uid: 'uid-code-ZZZ',
      meta: { metrics: true },
    },
    aaa: {
      type: 'test-db',
      name: 'aaa',
      uid: 'uid-code-aaa',
      meta: { metrics: true },
    },
    BBB: {
      type: 'test-db',
      name: 'BBB',
      uid: 'uid-code-BBB',
      meta: { metrics: true },
      isDefault: true,
    },
    DDDD: {
      type: 'test-db',
      name: 'DDDD',
      uid: 'uid-code-DDDD',
      meta: { metrics: true },
    },
    Jaeger: {
      type: 'jaeger-db',
      name: 'Jaeger',
      uid: 'uid-code-Jaeger',
      meta: { tracing: true, id: 'jaeger' },
    },
    CannotBeQueried: {
      type: 'no-query',
      name: 'no-query',
      uid: 'no-query',
      meta: { id: 'no-query' },
    },
    TestData: {
      type: 'grafana-testdata-datasource',
      name: 'TestData',
      uid: 'testdata',
      meta: { metrics: true, id: 'grafana-testdata-datasource', aliasIDs: ['testdata'] },
    },
    Prometheus: {
      type: 'prometheus',
      name: 'Prometheus',
      uid: 'uid-code-prometheus',
      meta: { metrics: true, id: 'prometheus' },
    },
    AmazonPrometheus: {
      type: 'grafana-amazonprometheus-datasource',
      name: 'Amazon Prometheus',
      uid: 'uid-code-amp',
      meta: { metrics: true, id: 'grafana-amazonprometheus-datasource' },
    },
    AzurePrometheus: {
      type: 'grafana-azureprometheus-datasource',
      name: 'Azure Prometheus',
      uid: 'uid-code-azp',
      meta: { metrics: true, id: 'grafana-azureprometheus-datasource' },
    },
  };

  describe('Given a list of data sources', () => {
    const runtimeDataSource = new TestRuntimeDataSource('grafana-runtime-datasource', 'uuid-runtime-ds');

    beforeAll(() => {
      dataSourceSrv.registerRuntimeDataSource({
        dataSource: runtimeDataSource,
      });
    });

    beforeEach(() => {
      dataSourceSrv.init(dataSourceInit as any, 'BBB');
    });

    describe('when getting data source class instance', () => {
      it('should load plugin and create instance and set meta', async () => {
        const ds = (await dataSourceSrv.get('mmm')) as any;
        expect(ds.meta).toBe(dataSourceInit.mmm.meta);
        expect(ds.instanceSettings).toBe(dataSourceInit.mmm);

        // validate that it caches instance
        const ds2 = await dataSourceSrv.get('mmm');
        expect(ds).toBe(ds2);
      });

      it('should be able to load data source using uid as well', async () => {
        const dsByUid = await dataSourceSrv.get('uid-code-mmm');
        const dsByName = await dataSourceSrv.get('mmm');
        expect(dsByUid.meta).toBe(dsByName.meta);
        expect(dsByUid).toBe(dsByName);
      });

      it('should patch legacy datasources', async () => {
        expect(TestDataSource instanceof DataSourceApi).toBe(false);
        const instance = await dataSourceSrv.get('mmm');
        expect(instance.name).toBe('mmm');
        expect(instance.type).toBe('test-db');
        expect(instance.uid).toBe('uid-code-mmm');
        expect(instance.getRef()).toEqual({ type: 'test-db', uid: 'uid-code-mmm' });
      });

      it('Can get by variable', async () => {
        const ds = await dataSourceSrv.get('${datasource}');
        expect(ds.meta).toBe(dataSourceInit.BBB.meta);

        const ds2 = await dataSourceSrv.get('${datasource}', { datasource: { text: 'Prom', value: 'uid-code-aaa' } });
        expect(ds2.uid).toBe(dataSourceInit.aaa.uid);
      });
    });

    describe('when getting instance settings', () => {
      it('should work by name or uid', () => {
        const ds = dataSourceSrv.getInstanceSettings('mmm');
        expect(dataSourceSrv.getInstanceSettings('uid-code-mmm')).toBe(ds);
        expect(dataSourceSrv.getInstanceSettings({ uid: 'uid-code-mmm' })).toBe(ds);
      });

      it('should work with variable by ds name', () => {
        const ds = dataSourceSrv.getInstanceSettings('${datasource}');
        expect(ds?.name).toBe('${datasource}');
        expect(ds?.uid).toBe('${datasource}');
        expect(ds?.rawRef).toMatchInlineSnapshot(`
          {
            "type": "test-db",
            "uid": "uid-code-BBB",
          }
        `);
      });

      it('should work with variable by ds value (uid)', () => {
        const ds = dataSourceSrv.getInstanceSettings('${datasourceByUid}');
        expect(ds?.name).toBe('${datasourceByUid}');
        expect(ds?.uid).toBe('${datasourceByUid}');
        expect(ds?.rawRef).toMatchInlineSnapshot(`
          {
            "type": "test-db",
            "uid": "uid-code-DDDD",
          }
        `);
      });

      it('should work with variable via scopedVars', () => {
        const ds = dataSourceSrv.getInstanceSettings('${datasource}', {
          datasource: { text: 'Prom', value: 'uid-code-aaa' },
        });
        expect(ds?.rawRef?.uid).toBe('uid-code-aaa');
      });

      it('should not set isDefault when being fetched via variable', () => {
        const ds = dataSourceSrv.getInstanceSettings('${datasource}');
        expect(ds?.isDefault).toBe(false);
      });

      it('should work with variable', () => {
        const ds = dataSourceSrv.getInstanceSettings('${datasourceDefault}');
        expect(ds?.name).toBe('${datasourceDefault}');
        expect(ds?.uid).toBe('${datasourceDefault}');
        expect(ds?.rawRef).toMatchInlineSnapshot(`
          {
            "type": "test-db",
            "uid": "uid-code-BBB",
          }
        `);
      });

      it('should return expression settings with either expression UIDs', () => {
        const exprWithOldUID = dataSourceSrv.getInstanceSettings('-100');
        expect(exprWithOldUID?.name).toBe('Expression');
        expect(exprWithOldUID?.uid).toBe(ExpressionDatasourceRef.uid);
        expect(exprWithOldUID?.type).toBe(ExpressionDatasourceRef.type);

        const exprWithNewUID = dataSourceSrv.getInstanceSettings('__expr__');
        expect(exprWithNewUID?.name).toBe('Expression');
        expect(exprWithNewUID?.uid).toBe(ExpressionDatasourceRef.uid);
        expect(exprWithNewUID?.type).toBe(ExpressionDatasourceRef.type);
      });

      it('should return expression settings with expression name', () => {
        const exprWithName = dataSourceSrv.getInstanceSettings('Expression');
        expect(exprWithName?.name).toBe(ExpressionDatasourceRef.name);
        expect(exprWithName?.uid).toBe(ExpressionDatasourceRef.uid);
        expect(exprWithName?.type).toBe(ExpressionDatasourceRef.type);
      });

      it('should return settings for runtime datasource when called with uid', () => {
        const settings = dataSourceSrv.getInstanceSettings(runtimeDataSource.uid);
        expect(settings).toBe(runtimeDataSource.instanceSettings);
      });

      it('should not return settings for runtime datasource when called with name', () => {
        const settings = dataSourceSrv.getInstanceSettings(runtimeDataSource.name);
        expect(settings).toBe(undefined);
      });

      it('should handle type-only datasource references consistently', async () => {
        const typeOnlyRef = { type: 'jaeger-db' };

        const datasource = await dataSourceSrv.get(typeOnlyRef);
        const settings = dataSourceSrv.getInstanceSettings(typeOnlyRef);

        expect(datasource.uid).toBe('uid-code-Jaeger');
        expect(datasource.type).toBe('jaeger-db');
        expect(settings?.uid).toBe(datasource.uid);
        expect(settings?.type).toBe(datasource.type);
        expect(settings?.name).toBe('Jaeger');
      });
    });

    describe('when loading datasource', () => {
      it('should load expressions', async () => {
        let api = await dataSourceSrv.loadDatasource('-100'); // Legacy expression id
        expect(api.uid).toBe(ExpressionDatasourceRef.uid);

        api = await dataSourceSrv.loadDatasource('__expr__'); // Legacy expression id
        expect(api.uid).toBe(ExpressionDatasourceRef.uid);

        api = await dataSourceSrv.loadDatasource('Expression'); // Legacy expression id
        expect(api.uid).toBe(ExpressionDatasourceRef.uid);
      });

      it('should load by variable', async () => {
        const api = await dataSourceSrv.loadDatasource('${datasource}');
        expect(api.meta).toBe(dataSourceInit.BBB.meta);
      });

      it('should load by name', async () => {
        let api = await dataSourceSrv.loadDatasource('ZZZ');
        expect(api.meta).toBe(dataSourceInit.ZZZ.meta);
      });
    });

    describe('when getting external metric sources', () => {
      it('should return list of explore sources', () => {
        const externalSources = dataSourceSrv.getExternal();
        expect(externalSources.length).toBe(11);
      });
    });

    describe('when getting datasource by type', () => {
      it('should return the first value of each type', async () => {
        const jaeger = await dataSourceSrv.get({ type: `jaeger-db` });
        const testdata = await dataSourceSrv.get({ type: `grafana-testdata-datasource` });
        expect(jaeger.uid).toBe('uid-code-Jaeger');
        expect(testdata.uid).toBe('testdata');
      });

      it('should prefer the default value', async () => {
        const api = await dataSourceSrv.get({ type: `test-db` });
        expect(api.uid).toBe('uid-code-BBB');
      });
    });

    it('Should by default filter out data sources that cannot be queried', () => {
      const list = dataSourceSrv.getList({});
      expect(list.find((x) => x.name === 'no-query')).toBeUndefined();
      const all = dataSourceSrv.getList({ all: true });
      expect(all.find((x) => x.name === 'no-query')).toBeDefined();
    });

    it('Can get list of data sources with variables: true', () => {
      const list = dataSourceSrv.getList({ metrics: true, variables: true });
      expect(list[0].name).toBe('${datasourceByUid}');
      expect(list[1].name).toBe('${datasourceDefault}');
      expect(list[2].name).toBe('${datasource}');
    });

    it('Should filter out the -- Grafana -- datasource', () => {
      const list = dataSourceSrv.getList({ filter: (x) => x.name !== '-- Grafana --' });
      expect(list.find((x) => x.name === '-- Grafana --')).toBeUndefined();
    });

    it('Can get list of data sources with tracing: true', () => {
      const list = dataSourceSrv.getList({ tracing: true });
      expect(list[0].name).toBe('Jaeger');
    });

    it('Can get list of data sources with annotation: true', () => {
      const list = dataSourceSrv.getList({ annotations: true });
      expect(list[0].name).toBe('mmm');
    });

    describe('get list filtered by plugin Id', () => {
      it('should list all data sources for specified plugin id', () => {
        const list = dataSourceSrv.getList({ pluginId: 'jaeger' });
        expect(list.length).toBe(1);
        expect(list[0].name).toBe('Jaeger');
      });

      it('should include Prometheus flavor data sources when pluginId is prometheus', () => {
        const list = dataSourceSrv.getList({ pluginId: 'prometheus' });
        expect(list.length).toBe(3);
        expect(list[0].name).toBe('Amazon Prometheus');
        expect(list[0].type).toBe('grafana-amazonprometheus-datasource');
        expect(list[1].name).toBe('Azure Prometheus');
        expect(list[1].type).toBe('grafana-azureprometheus-datasource');
        expect(list[2].name).toBe('Prometheus');
        expect(list[2].type).toBe('prometheus');
      });

      it('should include compatible Prometheus data sources when pluginId is a flavor of prometheus', () => {
        const list = dataSourceSrv.getList({ pluginId: 'grafana-amazonprometheus-datasource' });
        expect(list.length).toBe(3);
        expect(list[0].name).toBe('Amazon Prometheus');
        expect(list[0].type).toBe('grafana-amazonprometheus-datasource');
        expect(list[1].name).toBe('Azure Prometheus');
        expect(list[1].type).toBe('grafana-azureprometheus-datasource');
        expect(list[2].name).toBe('Prometheus');
        expect(list[2].type).toBe('prometheus');
      });

      it('should not include runtime datasources in list', () => {
        const list = dataSourceSrv.getList({ pluginId: 'grafana-runtime-datasource' });
        expect(list.length).toBe(0);
      });
    });

    it('Can get get list and filter by an alias', () => {
      const list = dataSourceSrv.getList({ pluginId: 'testdata' });
      expect(list[0].name).toBe('TestData');
      expect(list.length).toBe(1);
    });

    it('Can get list  of data sources with metrics: true, builtIn: true, mixed: true', () => {
      expect(dataSourceSrv.getList({ metrics: true, dashboard: true, mixed: true })).toMatchInlineSnapshot(`
        [
          {
            "meta": {
              "metrics": true,
            },
            "name": "aaa",
            "type": "test-db",
            "uid": "uid-code-aaa",
          },
          {
            "meta": {
              "id": "grafana-amazonprometheus-datasource",
              "metrics": true,
            },
            "name": "Amazon Prometheus",
            "type": "grafana-amazonprometheus-datasource",
            "uid": "uid-code-amp",
          },
          {
            "meta": {
              "id": "grafana-azureprometheus-datasource",
              "metrics": true,
            },
            "name": "Azure Prometheus",
            "type": "grafana-azureprometheus-datasource",
            "uid": "uid-code-azp",
          },
          {
            "isDefault": true,
            "meta": {
              "metrics": true,
            },
            "name": "BBB",
            "type": "test-db",
            "uid": "uid-code-BBB",
          },
          {
            "meta": {
              "metrics": true,
            },
            "name": "DDDD",
            "type": "test-db",
            "uid": "uid-code-DDDD",
          },
          {
            "meta": {
              "annotations": true,
              "metrics": true,
            },
            "name": "mmm",
            "type": "test-db",
            "uid": "uid-code-mmm",
          },
          {
            "meta": {
              "id": "prometheus",
              "metrics": true,
            },
            "name": "Prometheus",
            "type": "prometheus",
            "uid": "uid-code-prometheus",
          },
          {
            "meta": {
              "aliasIDs": [
                "testdata",
              ],
              "id": "grafana-testdata-datasource",
              "metrics": true,
            },
            "name": "TestData",
            "type": "grafana-testdata-datasource",
            "uid": "testdata",
          },
          {
            "meta": {
              "metrics": true,
            },
            "name": "ZZZ",
            "type": "test-db",
            "uid": "uid-code-ZZZ",
          },
          {
            "meta": {
              "builtIn": true,
              "id": "mixed",
              "metrics": true,
            },
            "name": "-- Mixed --",
            "type": "datasource",
            "uid": "-- Mixed --",
          },
          {
            "meta": {
              "builtIn": true,
              "id": "dashboard",
              "metrics": true,
            },
            "name": "-- Dashboard --",
            "type": "datasource",
            "uid": "-- Dashboard --",
          },
          {
            "meta": {
              "builtIn": true,
              "id": "grafana",
              "metrics": true,
            },
            "name": "-- Grafana --",
            "type": "datasource",
            "uid": "-- Grafana --",
          },
        ]
      `);
    });

    describe('when calling reload', () => {
      it('should reload the datasource list', async () => {
        // arrange
        getBackendSrvGetMock.mockReturnValueOnce({
          datasources: {
            ...dataSourceInit,
          },
          defaultDatasource: 'aaa',
        });
        const initMock = jest.spyOn(dataSourceSrv, 'init').mockImplementation(() => {});
        // act
        await dataSourceSrv.reload();
        // assert
        expect(getBackendSrvGetMock).toHaveBeenCalledWith('/api/frontend/settings');
        expect(initMock).toHaveBeenCalledWith(dataSourceInit, 'aaa');
      });

      it('should still be possible to get registered runtime data source', async () => {
        getBackendSrvGetMock.mockReturnValueOnce({
          datasources: {
            ...dataSourceInit,
          },
          defaultDatasource: 'aaa',
        });

        await dataSourceSrv.reload();
        const ds = await dataSourceSrv.get(runtimeDataSource.getRef());
        expect(ds).toBe(runtimeDataSource);
      });
    });

    describe('when registering runtime datasources', () => {
      it('should have registered a runtime datasource', async () => {
        const ds = await dataSourceSrv.get(runtimeDataSource.getRef());
        expect(ds).toBe(runtimeDataSource);
      });

      it('should throw when trying to re-register a runtime datasource', () => {
        expect(() =>
          dataSourceSrv.registerRuntimeDataSource({
            dataSource: runtimeDataSource,
          })
        ).toThrow();
      });

      it('should throw when trying to register a runtime datasource with the same uid as an "regular" datasource', async () => {
        expect(() =>
          dataSourceSrv.registerRuntimeDataSource({
            dataSource: new TestRuntimeDataSource('grafana-runtime-datasource', 'uid-code-Jaeger'),
          })
        ).toThrow();
      });
    });
  });

  describe('getNameOrUid', () => {
    it('should return expression uid __expr__', () => {
      expect(getNameOrUid('__expr__')).toBe(ExpressionDatasourceRef.uid);
      expect(getNameOrUid('-100')).toBe(ExpressionDatasourceRef.uid);
      expect(getNameOrUid('Expression')).toBe(ExpressionDatasourceRef.uid);
      expect(getNameOrUid({ type: '__expr__' })).toBe(ExpressionDatasourceRef.uid);
      expect(getNameOrUid({ type: '-100' })).toBe(ExpressionDatasourceRef.uid);
    });

    it('should return ref if it is string', () => {
      const value = 'mixed-datasource';
      const nameOrUid = getNameOrUid(value);
      expect(nameOrUid).not.toBeUndefined();
      expect(nameOrUid).toBe(value);
    });

    it('should return the uid if the ref is not string', () => {
      const value = { type: 'mixed', uid: 'theUID' };
      const nameOrUid = getNameOrUid(value);
      expect(nameOrUid).not.toBeUndefined();
      expect(nameOrUid).toBe(value.uid);
    });

    it('should return undefined if the ref has no uid', () => {
      const value = { type: 'mixed' };
      const nameOrUid = getNameOrUid(value);
      expect(nameOrUid).toBeUndefined();
    });
  });
});
