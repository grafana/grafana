import {describe, beforeEach, it, sinon, expect, angularMocks} from "test/lib/common";
import helpers from 'test/specs/helpers';
import {KairosDBDatasource} from '../datasource';

describe('KairosDBDatasource', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {
      url: "",
      name: "KairosDB datasource 1",
      withCredentials: false,
      type: "kairosdb"
    };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));

  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
        ctx.$q = $q;
        ctx.$httpBackend = $httpBackend;
        ctx.$rootScope = $rootScope;
        ctx.ds = $injector.instantiate(KairosDBDatasource, {instanceSettings: instanceSettings});
        $httpBackend.when('GET', /\.html$/).respond('');
    }));

  describe('When querying kairosdb with one target using query editor target spec', function() {
    var results;
    var urlExpected = "/api/v1/datapoints/query";
    var bodyExpected = {
      metrics: [{ name: ["test"] }],
      cache_time: 0,
      start_relative: {
        value: "1",
        unit: "hours"
      }
    };

    var query = {
      rangeRaw: { from: 'now-1h', to: 'now' },
      targets: [{ metric: 'test', downsampling: '(NONE)'}]
    };

    var response = {
      queries: [{
        sample_size: 60,
        results: [{
          name: "test",
          values: [[1420070400000, 1]]
        }]
      }]
    };

    beforeEach(function() {
      ctx.$httpBackend.expect('POST', urlExpected, bodyExpected).respond(response);
      ctx.ds.query(query).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it('should generate the correct query', function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });

    it('should return series list', function() {
      expect(results.data.length).to.be(1);
      expect(results.data[0].target).to.be('test');
    });

  });

});
