import 'app/features/plugins/datasource_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { DataSourceInstanceSettings, DataSourcePlugin, DataSourcePluginMeta, PluginMeta } from '@grafana/data';

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
  ],
  replace: (v: string) => v,
};

class TestDataSource {
  constructor(public instanceSettings: DataSourceInstanceSettings) {}
}

jest.mock('../plugin_loader', () => ({
  importDataSourcePlugin: () => {
    return Promise.resolve(new DataSourcePlugin(TestDataSource as any));
  },
}));

describe('datasource_srv', () => {
  const _datasourceSrv = new DatasourceSrv({} as any, {} as any, templateSrv);
  const datasources = {
    buildIn: {
      id: 1,
      uid: '1',
      type: 'b',
      name: 'buildIn',
      meta: { builtIn: true } as DataSourcePluginMeta,
      jsonData: {},
    },
    external1: {
      id: 2,
      uid: '2',
      type: 'e',
      name: 'external1',
      meta: { builtIn: false } as DataSourcePluginMeta,
      jsonData: {},
    },
    external2: {
      id: 3,
      uid: '3',
      type: 'e2',
      name: 'external2',
      meta: {} as PluginMeta,
      jsonData: {},
    },
  };

  beforeEach(() => {
    _datasourceSrv.init(datasources, 'external1');
  });

  describe('when getting data source class instance', () => {
    it('should load plugin and create instance and set meta', async () => {
      const ds = (await _datasourceSrv.get('external1')) as any;
      expect(ds.meta).toBe(datasources.external1.meta);
      expect(ds.instanceSettings).toBe(datasources.external1);

      // validate that it caches instance
      const ds2 = await _datasourceSrv.get('external1');
      expect(ds).toBe(ds2);
    });

    it('should be able to load data source using uid as well', async () => {
      const dsByUid = await _datasourceSrv.get('2');
      const dsByName = await _datasourceSrv.get('external1');
      expect(dsByUid.meta).toBe(datasources.external1.meta);
      expect(dsByUid).toBe(dsByName);
    });
  });

  describe('when getting external metric sources', () => {
    it('should return list of explore sources', () => {
      const externalSources = _datasourceSrv.getExternal();
      expect(externalSources.length).toBe(2);
      expect(externalSources[0].name).toBe('external1');
      expect(externalSources[1].name).toBe('external2');
    });
  });

  describe('when loading metric sources', () => {
    let metricSources: any;

    beforeEach(() => {
      _datasourceSrv.init(
        {
          mmm: {
            type: 'test-db',
            meta: { metrics: true } as any,
          },
          '--Grafana--': {
            type: 'grafana',
            meta: { builtIn: true, metrics: true, id: 'grafana' },
          },
          '--Mixed--': {
            type: 'test-db',
            meta: { builtIn: true, metrics: true, id: 'mixed' },
          },
          ZZZ: {
            type: 'test-db',
            meta: { metrics: true },
          },
          aaa: {
            type: 'test-db',
            meta: { metrics: true },
          },
          BBB: {
            type: 'test-db',
            meta: { metrics: true },
          },
        } as any,
        'BBB'
      );
      metricSources = _datasourceSrv.getMetricSources({});
    });

    it('should return a list of sources sorted case insensitively with builtin sources last', () => {
      expect(metricSources[1].name).toBe('aaa');
      expect(metricSources[2].name).toBe('BBB');
      expect(metricSources[3].name).toBe('default');
      expect(metricSources[4].name).toBe('mmm');
      expect(metricSources[5].name).toBe('ZZZ');
      expect(metricSources[6].name).toBe('--Grafana--');
      expect(metricSources[7].name).toBe('--Mixed--');
    });

    it('should set default data source', () => {
      expect(metricSources[3].name).toBe('default');
      expect(metricSources[3].sort).toBe('BBB');
    });

    it('should set default inject the variable datasources', () => {
      expect(metricSources[0].name).toBe('$datasource');
      expect(metricSources[0].sort).toBe('$datasource');
    });
  });
});
