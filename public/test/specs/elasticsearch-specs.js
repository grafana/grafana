define([
  './helpers',
  'moment',
  'angular',
  'app/plugins/datasource/elasticsearch/datasource',
], function(helpers, moment, angular) {
  'use strict';

  describe('ElasticDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv', 'backendSrv']));
    beforeEach(ctx.createService('ElasticDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({jsonData: {}});
    });

    describe('When testing datasource with index pattern', function() {
      beforeEach(function() {
        ctx.ds = new ctx.service({
          url: 'http://es.com',
          index: '[asd-]YYYY.MM.DD',
          jsonData: { interval: 'Daily' }
        });
      });

      it('should translate index pattern to current day', function() {
        var requestOptions;
        ctx.backendSrv.datasourceRequest = function(options) {
          requestOptions = options;
          return ctx.$q.when({});
        };

        ctx.ds.testDatasource();
        ctx.$rootScope.$apply();

        var today = moment().format("YYYY.MM.DD");
        expect(requestOptions.url).to.be("http://es.com/asd-" + today + '/_stats');
      });
    });

    describe('When issueing metric query with interval pattern', function() {
      beforeEach(function() {
        ctx.ds = new ctx.service({
          url: 'http://es.com',
          index: '[asd-]YYYY.MM.DD',
          jsonData: { interval: 'Daily' }
        });
      });

      it('should translate index pattern to current day', function() {
        var requestOptions;
        ctx.backendSrv.datasourceRequest = function(options) {
          requestOptions = options;
          return ctx.$q.when({data: {responses: []}});
        };

        ctx.ds.query({
          range: {
            from: new Date(2015, 4, 30, 10),
            to: new Date(2015, 5, 1, 10)
          },
          targets: [{ bucketAggs: [], metrics: [] }]
        });

        ctx.$rootScope.$apply();
        var parts = requestOptions.data.split('\n');
        var header = angular.fromJson(parts[0]);
        expect(header.index).to.eql(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
      });

    });

  });

});
