import {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePlugin,
  DataSourcePluginMeta,
  ScopedVars,
} from '@grafana/data';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { DatasourceSrv, getNameOrUid } from 'app/features/plugins/datasource_srv';

// Datasource variable $datasource with current value 'BBB'
const templateSrv: any = {
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
};

class TestDataSource {
  constructor(public instanceSettings: DataSourceInstanceSettings) {}
}

jest.mock('../plugin_loader', () => ({
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
      meta: { metrics: true, annotations: true } as any,
    },
    '-- Grafana --': {
      type: 'grafana',
      name: '-- Grafana --',
      meta: { builtIn: true, metrics: true, id: 'grafana' },
    },
    '-- Dashboard --': {
      type: 'dashboard',
      name: '-- Dashboard --',
      meta: { builtIn: true, metrics: true, id: 'dashboard' },
    },
    '-- Mixed --': {
      type: 'test-db',
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
  };

  describe('Given a list of data sources', () => {
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
        const ds = (await dataSourceSrv.get('${datasource}')) as any;
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
        expect(externalSources.length).toBe(7);
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

    it('Can get list of data sources with tracing: true', () => {
      const list = dataSourceSrv.getList({ tracing: true });
      expect(list[0].name).toBe('Jaeger');
    });

    it('Can get list of data sources with annotation: true', () => {
      const list = dataSourceSrv.getList({ annotations: true });
      expect(list[0].name).toBe('mmm');
    });

    it('Can get get list and filter by pluginId', () => {
      const list = dataSourceSrv.getList({ pluginId: 'jaeger' });
      expect(list[0].name).toBe('Jaeger');
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
            "type": "test-db",
            "uid": "-- Mixed --",
          },
          {
            "meta": {
              "builtIn": true,
              "id": "dashboard",
              "metrics": true,
            },
            "name": "-- Dashboard --",
            "type": "dashboard",
            "uid": "-- Dashboard --",
          },
          {
            "meta": {
              "builtIn": true,
              "id": "grafana",
              "metrics": true,
            },
            "name": "-- Grafana --",
            "type": "grafana",
            "uid": "-- Grafana --",
          },
        ]
      `);
    });

    it('Should reload the datasource', async () => {
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
