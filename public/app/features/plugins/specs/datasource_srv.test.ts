import config from 'app/core/config';
import 'app/features/plugins/datasource_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PluginMeta, DataSourcePluginMeta } from '@grafana/data';

// Datasource variable $datasource with current value 'BBB'
const templateSrv: any = {
  variables: [
    {
      type: 'datasource',
      name: 'datasource',
      current: {
        value: 'BBB',
      },
    },
  ],
};

describe('datasource_srv', () => {
  const _datasourceSrv = new DatasourceSrv({}, {} as any, {} as any, templateSrv);

  describe('when loading external datasources', () => {
    beforeEach(() => {
      config.datasources = {
        buildInDs: {
          id: 1,
          type: 'b',
          name: 'buildIn',
          meta: { builtIn: true } as DataSourcePluginMeta,
          jsonData: {},
        },
        nonBuildIn: {
          id: 2,
          type: 'e',
          name: 'external1',
          meta: { builtIn: false } as DataSourcePluginMeta,
          jsonData: {},
        },
        nonExplore: {
          id: 3,
          type: 'e2',
          name: 'external2',
          meta: {} as PluginMeta,
          jsonData: {},
        },
      };
    });

    it('should return list of explore sources', () => {
      const externalSources = _datasourceSrv.getExternal();
      expect(externalSources.length).toBe(2);
      expect(externalSources[0].name).toBe('external1');
      expect(externalSources[1].name).toBe('external2');
    });
  });

  describe('when loading metric sources', () => {
    let metricSources: any;
    const unsortedDatasources = {
      mmm: {
        type: 'test-db',
        meta: { metrics: { m: 1 } },
      },
      '--Grafana--': {
        type: 'grafana',
        meta: { builtIn: true, metrics: { m: 1 }, id: 'grafana' },
      },
      '--Mixed--': {
        type: 'test-db',
        meta: { builtIn: true, metrics: { m: 1 }, id: 'mixed' },
      },
      ZZZ: {
        type: 'test-db',
        meta: { metrics: { m: 1 } },
      },
      aaa: {
        type: 'test-db',
        meta: { metrics: { m: 1 } },
      },
      BBB: {
        type: 'test-db',
        meta: { metrics: { m: 1 } },
      },
    };
    beforeEach(() => {
      config.datasources = unsortedDatasources as any;
      metricSources = _datasourceSrv.getMetricSources({});
      config.defaultDatasource = 'BBB';
    });

    it('should return a list of sources sorted case insensitively with builtin sources last', () => {
      expect(metricSources[1].name).toBe('aaa');
      expect(metricSources[2].name).toBe('BBB');
      expect(metricSources[3].name).toBe('mmm');
      expect(metricSources[4].name).toBe('ZZZ');
      expect(metricSources[5].name).toBe('--Grafana--');
      expect(metricSources[6].name).toBe('--Mixed--');
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
