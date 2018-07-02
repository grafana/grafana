import config from 'app/core/config';
import 'app/features/plugins/datasource_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

describe('datasource_srv', function() {
  let _datasourceSrv = new DatasourceSrv({}, {}, {}, {});
  let metricSources;

  describe('when loading metric sources', () => {
    let unsortedDatasources = {
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
      config.datasources = unsortedDatasources;
      metricSources = _datasourceSrv.getMetricSources({ skipVariables: true });
    });

    it('should return a list of sources sorted case insensitively with builtin sources last', () => {
      expect(metricSources[0].name).toBe('aaa');
      expect(metricSources[1].name).toBe('BBB');
      expect(metricSources[2].name).toBe('mmm');
      expect(metricSources[3].name).toBe('ZZZ');
      expect(metricSources[4].name).toBe('--Grafana--');
      expect(metricSources[5].name).toBe('--Mixed--');
    });

    beforeEach(() => {
      config.defaultDatasource = 'BBB';
    });

    it('should set default data source', () => {
      expect(metricSources[2].name).toBe('default');
      expect(metricSources[2].sort).toBe('BBB');
    });
  });
});
