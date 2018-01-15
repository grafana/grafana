import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import config from 'app/core/config';
import 'app/features/plugins/datasource_srv';

describe('datasource_srv', function() {
  var _datasourceSrv;
  var metricSources;
  var templateSrv = {};

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(
    angularMocks.module(function($provide) {
      $provide.value('templateSrv', templateSrv);
    })
  );
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(
    angularMocks.inject(function(datasourceSrv) {
      _datasourceSrv = datasourceSrv;
    })
  );

  describe('when loading metric sources', function() {
    var unsortedDatasources = {
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
    beforeEach(function() {
      config.datasources = unsortedDatasources;
      metricSources = _datasourceSrv.getMetricSources({ skipVariables: true });
    });

    it('should return a list of sources sorted case insensitively with builtin sources last', function() {
      expect(metricSources[0].name).to.be('aaa');
      expect(metricSources[1].name).to.be('BBB');
      expect(metricSources[2].name).to.be('mmm');
      expect(metricSources[3].name).to.be('ZZZ');
      expect(metricSources[4].name).to.be('--Grafana--');
      expect(metricSources[5].name).to.be('--Mixed--');
    });
  });
});
