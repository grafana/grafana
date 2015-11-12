define([
  './helpers',
  'app/plugins/datasource/kairosdb/datasource'
], function(helpers) {
  'use strict';

  describe('KairosDBDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv']));
    beforeEach(ctx.createService('KairosDBDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({ url: ''});
    });

    describe('When querying kairosdb with one target using query editor target spec', function() {
      var results;
      var urlExpected = "/api/v1/datapoints/query";
      var bodyExpected = {
        metrics: [{ name: "test" }],
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

});
